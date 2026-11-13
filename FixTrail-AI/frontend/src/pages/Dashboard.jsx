
import { useEffect, useState } from 'react';
import PassportList from '../components/PassportList';

import {
  apiRequest,
  logout,
  uploadRepairImage,
  getRepairImages,
  submitReview,
  getTechnicianReviews,
  getImageUrl,
  getRepairEstimates,
  selectRepairEstimate,
  verifyRepair,
  describeDamageImage,
} from '../services/api';

export default function Dashboard({ user, onLogout }) {
  const [repairs, setRepairs] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    appliance_name: '',
    problem_description: '',
  });

  const [damageFiles, setDamageFiles] = useState([]);
  const [completionFiles, setCompletionFiles] = useState({});
  const [estimate, setEstimate] = useState({});
  const [images, setImages] = useState({});
  const [repairEstimates, setRepairEstimates] = useState({});
  const [ratings, setRatings] = useState({});
  const [reviewForms, setReviewForms] = useState({});
  const [reviewedRepairs, setReviewedRepairs] = useState({});
  const [verificationReports, setVerificationReports] = useState({});
  const [verificationLoading, setVerificationLoading] = useState({});

  // AI damage description state
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  const isCustomer = user.role === 'customer';

  // Load repairs and related information
  const loadRepairs = async () => {
    setLoading(true);

    try {
      const endpoint = isCustomer
        ? '/api/repairs/my'
        : '/api/repairs/available';

      const data = await apiRequest(endpoint);
      setRepairs(data);

      const imageResults = {};
      const estimateResults = {};
      const ratingResults = {};

      for (const repair of data) {
        try {
          imageResults[repair.id] = await getRepairImages(repair.id);
        } catch {
          imageResults[repair.id] = [];
        }

        if (isCustomer && repair.status === 'reported') {
          try {
            estimateResults[repair.id] =
              await getRepairEstimates(repair.id);
          } catch {
            estimateResults[repair.id] = [];
          }
        }

        if (isCustomer && repair.technician_id) {
          try {
            ratingResults[repair.technician_id] =
              await getTechnicianReviews(repair.technician_id);
          } catch {
            // No rating available yet
          }
        }
      }

      setImages(imageResults);
      setRepairEstimates(estimateResults);
      setRatings(ratingResults);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepairs();
  }, []);

  // Generate a description from the first uploaded damage image
  const generateDamageDescription = async () => {
    if (!damageFiles.length) {
      setMessage('Please upload a damage image first.');
      return;
    }

    setDescriptionLoading(true);
    setMessage('');

    try {
      const result = await describeDamageImage(damageFiles[0]);

      if (!result.description) {
        throw new Error('AI could not generate a description.');
      }

      setForm((previous) => ({
        ...previous,
        problem_description: previous.problem_description.trim()
          ? `${previous.problem_description.trim()}\n\nAI image suggestion: ${result.description}`
          : result.description,
      }));

      setMessage(
        'AI description generated. Please review and edit it before submitting.'
      );
    } catch (error) {
      setMessage(error.message || 'Unable to generate image description.');
    } finally {
      setDescriptionLoading(false);
    }
  };

  // Customer creates repair
  const createRepair = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const repair = await apiRequest('/api/repairs/', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      for (const file of damageFiles) {
        await uploadRepairImage(
          repair.id,
          file,
          'customer_damage'
        );
      }

      setForm({
        appliance_name: '',
        problem_description: '',
      });

      setDamageFiles([]);

      setMessage('Repair request submitted successfully!');
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
      await loadRepairs();
    }
  };

  // General action
  const performAction = async (
    path,
    method = 'POST',
    body = null
  ) => {
    setMessage('');

    try {
      await apiRequest(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });

      setMessage('Action completed successfully!');
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // Technician submits estimate
  const submitEstimate = async (repairId) => {
    const value = estimate[repairId];

    if (!value?.cost || !value?.description?.trim()) {
      setMessage('Enter estimate amount and description.');
      return;
    }

    await performAction(
      `/api/repairs/${repairId}/estimate`,
      'POST',
      {
        estimated_cost: Number(value.cost),
        estimate_description: value.description,
      }
    );
  };

  // Customer selects estimate
  const chooseEstimate = async (repairId, estimateId) => {
    try {
      await selectRepairEstimate(repairId, estimateId);

      setMessage('Technician selected successfully!');
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // Technician uploads completion images
  const uploadCompletionImages = async (repairId) => {
    const files = completionFiles[repairId] || [];

    if (!files.length) {
      setMessage('Please select completion images.');
      return;
    }

    try {
      for (const file of files) {
        await uploadRepairImage(
          repairId,
          file,
          'repair_completion'
        );
      }

      setCompletionFiles((previous) => ({
        ...previous,
        [repairId]: [],
      }));

      setMessage('Completion images uploaded successfully!');
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // Customer submits review
  const handleReview = async (repairId) => {
    const review = reviewForms[repairId];

    if (!review?.rating) {
      setMessage('Please select a star rating.');
      return;
    }

    try {
      await submitReview(repairId, {
        rating: Number(review.rating),
        comment: review.comment || '',
      });

      setReviewedRepairs((previous) => ({
        ...previous,
        [repairId]: true,
      }));

      setMessage('Review submitted successfully!');
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // Customer runs AI visual verification after repair completion
  const handleVerifyRepair = async (repairId) => {
    setMessage('');

    setVerificationLoading((previous) => ({
      ...previous,
      [repairId]: true,
    }));

    try {
      const result = await verifyRepair(repairId);

      setVerificationReports((previous) => ({
        ...previous,
        [repairId]: result,
      }));

      setMessage('AI repair verification completed.');
    } catch (error) {
      setMessage(error.message || 'AI verification failed.');
    } finally {
      setVerificationLoading((previous) => ({
        ...previous,
        [repairId]: false,
      }));
    }
  };

  // Display images
  const renderImages = (repairId, imageType) => {
    const list = (images[repairId] || []).filter(
      (item) => item.image_type === imageType
    );

    if (!list.length) {
      return (
        <p className="mt-2 text-sm text-slate-500">
          No images uploaded yet.
        </p>
      );
    }

    return (
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((item) => (
          <a
            key={item.id}
            href={getImageUrl(item.file_path)}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={getImageUrl(item.file_path)}
              alt="Repair evidence"
              className="h-32 w-full rounded-lg border border-slate-700 object-cover"
            />
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* NAVBAR */}
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
        <h1 className="text-2xl font-bold text-blue-400">
          FixTrail AI
        </h1>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">
            {user.full_name} · {user.role}
          </span>

          <button
            onClick={() => {
              logout();
              onLogout();
            }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* HEADER */}
        <h2 className="mb-2 text-3xl font-bold">
          {isCustomer
            ? 'Customer Dashboard'
            : 'Technician Dashboard'}
        </h2>

        <p className="mb-8 text-slate-400">
          {isCustomer
            ? 'Report problems, compare estimates and track repairs.'
            : 'View repair requests and submit competitive estimates.'}
        </p>

        {message && (
          <div className="mb-6 rounded-lg bg-blue-950 p-4 text-blue-200">
            {message}
          </div>
        )}

        {/* CUSTOMER CREATE REPAIR */}
        {isCustomer && (
          <form
            onSubmit={createRepair}
            className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h3 className="mb-5 text-xl font-semibold">
              Report a repair
            </h3>

            <input
              required
              minLength={2}
              placeholder="Appliance name"
              value={form.appliance_name}
              onChange={(e) =>
                setForm((previous) => ({
                  ...previous,
                  appliance_name: e.target.value,
                }))
              }
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />

            <textarea
              required
              minLength={10}
              placeholder="Describe the problem..."
              value={form.problem_description}
              onChange={(e) =>
                setForm((previous) => ({
                  ...previous,
                  problem_description: e.target.value,
                }))
              }
              className="mb-4 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />

            <label className="mb-2 block font-medium">
              Upload damage images
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) =>
                setDamageFiles(Array.from(e.target.files || []))
              }
              className="mb-4 block w-full text-sm text-slate-300"
            />

            {/* AI DAMAGE DESCRIPTION BUTTON */}
            {damageFiles.length > 0 && (
              <div className="mb-5 rounded-xl border border-purple-800 bg-purple-950/30 p-4">
                <h4 className="mb-2 font-semibold text-purple-300">
                  AI Image Description
                </h4>

                <p className="mb-3 text-sm text-slate-300">
                  Let AI identify visible damage in your uploaded image
                  and suggest text for the problem description.
                </p>

                <button
                  type="button"
                  onClick={generateDamageDescription}
                  disabled={descriptionLoading}
                  className="rounded-lg bg-purple-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {descriptionLoading
                    ? 'Analyzing image...'
                    : '✨ Generate description using AI'}
                </button>

                <p className="mt-3 text-xs text-slate-400">
                  AI suggestions are optional. Review and edit the
                  generated description before submitting.
                </p>
              </div>
            )}

            {/* DAMAGE IMAGE PREVIEW */}
            {damageFiles.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {damageFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`}>
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Damage preview"
                      className="h-28 w-full rounded-lg object-cover"
                    />
                    <p className="truncate text-xs text-slate-400">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50"
            >
              Submit repair request
            </button>
          </form>
        )}

        {/* REPAIR LIST */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            {isCustomer ? 'My repairs' : 'Available repair jobs'}
          </h3>

          <button
            onClick={loadRepairs}
            disabled={loading}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">

          {repairs.map((repair) => (
            <div
              key={repair.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >

              {/* REPAIR INFORMATION */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold">
                  {repair.appliance_name}
                </h4>

                <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">
                  {repair.status}
                </span>
              </div>

              <p className="mb-4 whitespace-pre-line text-sm text-slate-400">
                {repair.problem_description}
              </p>

              <p className="mb-3 text-sm">
                Repair ID: #{repair.id}
              </p>

              {/* DAMAGE IMAGES */}
              <div className="mb-5 border-t border-slate-800 pt-4">
                <h5 className="font-semibold text-blue-300">
                  Customer damage images
                </h5>
                {renderImages(repair.id, 'customer_damage')}
              </div>

              {/* CUSTOMER ESTIMATE COMPARISON */}
              {isCustomer && repair.status === 'reported' && (
                <div className="my-5 border-t border-slate-800 pt-4">
                  <h5 className="mb-3 text-lg font-semibold text-blue-300">
                    Technician estimates
                  </h5>

                  {(repairEstimates[repair.id] || []).length === 0 && (
                    <p className="text-sm text-slate-400">
                      Waiting for technician estimates.
                    </p>
                  )}

                  <div className="space-y-3">
                    {(repairEstimates[repair.id] || []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h6 className="font-semibold">
                            Technician #{item.technician_id}
                          </h6>

                          <span className="font-bold text-green-400">
                            ₹{item.estimated_cost}
                          </span>
                        </div>

                        <p className="my-3 text-sm text-slate-400">
                          {item.estimate_description}
                        </p>

                        <button
                          onClick={() =>
                            chooseEstimate(repair.id, item.id)
                          }
                          className="rounded-lg bg-blue-600 px-4 py-2"
                        >
                          Select this technician
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SELECTED ESTIMATE */}
              {repair.estimated_cost != null && (
                <div className="mb-4 rounded-lg bg-slate-800 p-4">
                  <p className="font-semibold text-green-400">
                    Selected estimate: ₹{repair.estimated_cost}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {repair.estimate_description}
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Technician: #{repair.technician_id}
                  </p>
                </div>
              )}

              {/* TECHNICIAN SUBMITS ESTIMATE */}
              {!isCustomer && repair.status === 'reported' && (
                <div className="space-y-3 border-t border-slate-800 pt-4">
                  <h5 className="font-semibold text-blue-300">
                    Submit your estimate
                  </h5>

                  <input
                    type="number"
                    min="1"
                    placeholder="Estimate amount (₹)"
                    value={estimate[repair.id]?.cost || ''}
                    onChange={(e) =>
                      setEstimate((previous) => ({
                        ...previous,
                        [repair.id]: {
                          ...previous[repair.id],
                          cost: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                  />

                  <textarea
                    placeholder="Describe proposed repair work"
                    value={estimate[repair.id]?.description || ''}
                    onChange={(e) =>
                      setEstimate((previous) => ({
                        ...previous,
                        [repair.id]: {
                          ...previous[repair.id],
                          description: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                  />

                  <button
                    onClick={() => submitEstimate(repair.id)}
                    className="rounded-lg bg-blue-600 px-4 py-2"
                  >
                    Submit estimate
                  </button>
                </div>
              )}

              {/* CUSTOMER APPROVES SELECTED ESTIMATE */}
              {isCustomer && repair.status === 'estimated' && (
                <button
                  onClick={() =>
                    performAction(`/api/repairs/${repair.id}/approve`)
                  }
                  className="rounded-lg bg-green-600 px-4 py-2"
                >
                  Approve estimate
                </button>
              )}

              {/* TECHNICIAN STARTS REPAIR */}
              {!isCustomer && repair.status === 'approved' && (
                <button
                  onClick={() =>
                    performAction(
                      `/api/repairs/${repair.id}/status?new_status=in_progress`,
                      'PATCH'
                    )
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2"
                >
                  Start repair
                </button>
              )}

              {/* COMPLETION IMAGE UPLOAD */}
              {!isCustomer &&
                ['approved', 'in_progress', 'completed'].includes(repair.status) && (
                  <div className="my-5 border-t border-slate-800 pt-4">
                    <h5 className="mb-3 font-semibold text-green-300">
                      Repair completion images
                    </h5>

                    {renderImages(repair.id, 'repair_completion')}

                    {repair.status !== 'completed' && (
                      <>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(e) =>
                            setCompletionFiles((previous) => ({
                              ...previous,
                              [repair.id]: Array.from(e.target.files || []),
                            }))
                          }
                          className="mt-4 block w-full text-sm text-slate-300"
                        />

                        <button
                          type="button"
                          onClick={() => uploadCompletionImages(repair.id)}
                          className="mt-3 rounded-lg bg-blue-600 px-4 py-2"
                        >
                          Upload completion images
                        </button>
                      </>
                    )}
                  </div>
                )}

              {/* TECHNICIAN COMPLETES REPAIR */}
              {!isCustomer && repair.status === 'in_progress' && (
                <button
                  onClick={() =>
                    performAction(
                      `/api/repairs/${repair.id}/status?new_status=completed`,
                      'PATCH'
                    )
                  }
                  className="rounded-lg bg-green-600 px-4 py-2"
                >
                  Mark completed
                </button>
              )}

              {/* CUSTOMER VIEWS COMPLETION IMAGES */}
              {isCustomer && repair.status === 'completed' && (
                <div className="mb-5 border-t border-slate-800 pt-4">
                  <h5 className="font-semibold text-green-300">
                    Technician repair evidence
                  </h5>

                  {renderImages(repair.id, 'repair_completion')}
                </div>
              )}

              {/* CUSTOMER AI REPAIR VERIFICATION */}
              {isCustomer && repair.status === 'completed' && (
                <div className="my-5 rounded-xl border border-purple-800 bg-purple-950/30 p-4">
                  <h5 className="mb-2 font-semibold text-purple-300">
                    AI Repair Verification
                  </h5>

                  <p className="mb-3 text-sm text-slate-300">
                    Compare the original damage photos with the technician's
                    completion photos and the approved repair description.
                  </p>

                  <button
                    type="button"
                    onClick={() => handleVerifyRepair(repair.id)}
                    disabled={Boolean(verificationLoading[repair.id])}
                    className="rounded-lg bg-purple-600 px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {verificationLoading[repair.id]
                      ? 'Analyzing images...'
                      : 'Run AI verification'}
                  </button>

                  {verificationReports[repair.id]?.report && (
                    <div className="mt-4 space-y-3 rounded-lg border border-slate-700 bg-slate-950 p-4">
                      {(() => {
                        const report = verificationReports[repair.id].report;
                        const status = report.verification_status || 'needs_review';

                        const statusClass =
                          status === 'verified'
                            ? 'text-green-400'
                            : status === 'mismatch'
                              ? 'text-red-400'
                              : 'text-yellow-400';

                        return (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                Verification result
                              </span>

                              <span className={`font-bold uppercase ${statusClass}`}>
                                {status.replaceAll('_', ' ')}
                              </span>
                            </div>

                            <p className="text-sm text-slate-300">
                              <strong>Confidence:</strong>{' '}
                              {Math.round((Number(report.confidence) || 0) * 100)}%
                            </p>

                            <p className="text-sm text-slate-300">
                              <strong>Explanation:</strong>{' '}
                              {report.explanation || 'No explanation provided.'}
                            </p>

                            {[
                              ['Original damage', report.original_damage],
                              ['Completed work detected', report.completed_work_detected],
                              ['Unresolved issues', report.unresolved_issues],
                            ].map(([heading, items]) => (
                              <div key={heading}>
                                <h6 className="mb-1 text-sm font-semibold text-slate-200">
                                  {heading}
                                </h6>

                                {Array.isArray(items) && items.length > 0 ? (
                                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                                    {items.map((item, index) => (
                                      <li key={`${heading}-${index}`}>
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    No items reported.
                                  </p>
                                )}
                              </div>
                            ))}

                            <p className="border-t border-slate-800 pt-3 text-xs text-slate-500">
                              AI visual assessment only. Photos cannot confirm
                              that the appliance functions correctly or is
                              electrically safe. Review uncertain results with
                              a qualified technician.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* TECHNICIAN RATING */}
              {isCustomer && repair.technician_id && (
                <div className="my-4 rounded-lg bg-slate-800 p-3">
                  <p className="font-semibold text-yellow-300">
                    Technician rating
                  </p>

                  <p className="mt-1">
                    ★ {ratings[repair.technician_id]?.average_rating || 'No rating'}
                    {ratings[repair.technician_id] && ' / 5'}
                  </p>

                  <p className="text-xs text-slate-400">
                    {ratings[repair.technician_id]?.total_reviews || 0} reviews
                  </p>
                </div>
              )}

              {/* CUSTOMER REVIEW */}
              {isCustomer && repair.status === 'completed' && (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <h5 className="mb-3 font-semibold">
                    Rate your technician
                  </h5>

                  {reviewedRepairs[repair.id] ? (
                    <p className="text-green-400">
                      Your review has been submitted.
                    </p>
                  ) : (
                    <>
                      <div className="mb-3 flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() =>
                              setReviewForms((previous) => ({
                                ...previous,
                                [repair.id]: {
                                  ...previous[repair.id],
                                  rating: star,
                                },
                              }))
                            }
                            className={`text-3xl ${
                              star <= (reviewForms[repair.id]?.rating || 0)
                                ? 'text-yellow-400'
                                : 'text-slate-600'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>

                      <textarea
                        placeholder="Write your feedback..."
                        value={reviewForms[repair.id]?.comment || ''}
                        onChange={(e) =>
                          setReviewForms((previous) => ({
                            ...previous,
                            [repair.id]: {
                              ...previous[repair.id],
                              comment: e.target.value,
                            },
                          }))
                        }
                        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                      />

                      <button
                        onClick={() => handleReview(repair.id)}
                        className="rounded-lg bg-yellow-600 px-4 py-2 font-semibold"
                      >
                        Submit review
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>

        {repairs.length === 0 && !loading && (
          <p className="rounded-xl border border-slate-800 p-8 text-center text-slate-400">
            No repair requests found.
          </p>
        )}

        {/* DIGITAL REPAIR PASSPORT */}
        {isCustomer && (
          <section className="mt-12 border-t border-slate-800 pt-8">
            <div className="mb-5">
              <h3 className="text-2xl font-bold text-blue-300">
                Digital Repair Passport
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                View your completed appliance repairs and their permanent
                repair records.
              </p>
            </div>

            <PassportList />
          </section>
        )}

      </main>
    </div>
  );
}
