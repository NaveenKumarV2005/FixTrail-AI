
import { useEffect, useState } from 'react'

import {
  apiRequest,
  logout,
  uploadRepairImage,
  getRepairImages,
  submitReview,
  getTechnicianReviews,
  getImageUrl,
} from '../services/api'

export default function Dashboard({ user, onLogout }) {
  const [repairs, setRepairs] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    appliance_name: '',
    problem_description: '',
  })

  const [estimate, setEstimate] = useState({})
  const [damageFiles, setDamageFiles] = useState({})
  const [completionFiles, setCompletionFiles] = useState({})
  const [images, setImages] = useState({})
  const [reviews, setReviews] = useState({})
  const [reviewForms, setReviewForms] = useState({})
  const [ratings, setRatings] = useState({})

  const isCustomer = user.role === 'customer'

  const loadRepairs = async () => {
    try {
      const endpoint = isCustomer
        ? '/api/repairs/my'
        : '/api/repairs/available'

      const data = await apiRequest(endpoint)
      setRepairs(data)

      // Load images for every repair
      for (const repair of data) {
        try {
          const imageData = await getRepairImages(repair.id)

          setImages(previous => ({
            ...previous,
            [repair.id]: imageData,
          }))
        } catch (error) {
          console.error('Image loading error:', error)
        }
      }

      // Load technician ratings
      if (isCustomer) {
        const technicianIds = [
          ...new Set(
            data
              .map(repair => repair.technician_id)
              .filter(Boolean)
          ),
        ]

        for (const technicianId of technicianIds) {
          try {
            const result = await getTechnicianReviews(technicianId)

            setRatings(previous => ({
              ...previous,
              [technicianId]: result,
            }))
          } catch (error) {
            console.error('Review loading error:', error)
          }
        }
      }
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    loadRepairs()
  }, [])

  const createRepair = async (e) => {
    e.preventDefault()
    setMessage('')

    try {
      const repair = await apiRequest('/api/repairs/', {
        method: 'POST',
        body: JSON.stringify(form),
      })

      const selectedFiles = damageFiles[repair.id] || []

      for (const file of selectedFiles) {
        await uploadRepairImage(
          repair.id,
          file,
          'customer_damage'
        )
      }

      setForm({
        appliance_name: '',
        problem_description: '',
      })

      setDamageFiles({})
      setMessage('Repair request and damage images submitted successfully!')

      await loadRepairs()
    } catch (error) {
      setMessage(error.message)
      await loadRepairs()
    }
  }

  const performAction = async (
    path,
    method = 'POST',
    body = null
  ) => {
    setMessage('')

    try {
      await apiRequest(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      })

      setMessage('Action completed successfully!')
      await loadRepairs()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const submitEstimate = async (repairId) => {
    const value = estimate[repairId]

    if (!value?.cost || !value?.description) {
      setMessage('Enter both estimate amount and description.')
      return
    }

    await performAction(
      `/api/repairs/${repairId}/estimate`,
      'POST',
      {
        estimated_cost: Number(value.cost),
        estimate_description: value.description,
      }
    )
  }

  const uploadCompletionImages = async (repairId) => {
    const selectedFiles = completionFiles[repairId] || []

    if (selectedFiles.length === 0) {
      setMessage('Please select at least one completion image.')
      return
    }

    try {
      for (const file of selectedFiles) {
        await uploadRepairImage(
          repairId,
          file,
          'repair_completion'
        )
      }

      setCompletionFiles(previous => ({
        ...previous,
        [repairId]: [],
      }))

      setMessage('Repair completion images uploaded!')
      await loadRepairs()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleReview = async (repairId) => {
    const review = reviewForms[repairId]

    if (!review?.rating) {
      setMessage('Please select a star rating.')
      return
    }

    try {
      await submitReview(repairId, {
        rating: Number(review.rating),
        comment: review.comment || '',
      })

      setMessage('Thank you! Your review has been submitted.')

      await loadRepairs()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const renderImages = (repairId, imageType) => {
    const repairImages = (images[repairId] || []).filter(
      image => image.image_type === imageType
    )

    if (repairImages.length === 0) {
      return (
        <p className="text-sm text-slate-500">
          No images uploaded yet.
        </p>
      )
    }

    return (
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {repairImages.map(image => (
          <a
            key={image.id}
            href={getImageUrl(image.file_path)}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={getImageUrl(image.file_path)}
              alt="Repair evidence"
              className="h-32 w-full rounded-lg border border-slate-700 object-cover"
            />
          </a>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
              logout()
              onLogout()
            }}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-2 text-3xl font-bold">
          {isCustomer ? 'Customer Dashboard' : 'Technician Dashboard'}
        </h2>

        <p className="mb-8 text-slate-400">
          {isCustomer
            ? 'Report appliance problems and track your repairs.'
            : 'Find repair requests and manage your assigned jobs.'}
        </p>

        {message && (
          <div className="mb-6 rounded-lg bg-blue-950 p-4 text-blue-200">
            {message}
          </div>
        )}

        {/* CUSTOMER REPAIR FORM */}
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
              placeholder="Appliance name (e.g. Washing Machine)"
              value={form.appliance_name}
              onChange={e =>
                setForm({
                  ...form,
                  appliance_name: e.target.value,
                })
              }
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />

            <textarea
              required
              minLength={10}
              placeholder="Describe the problem..."
              value={form.problem_description}
              onChange={e =>
                setForm({
                  ...form,
                  problem_description: e.target.value,
                })
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
              onChange={e =>
                setDamageFiles({
                  ...damageFiles,
                  new: Array.from(e.target.files || []),
                })
              }
              className="mb-3 block w-full text-sm text-slate-300"
            />

            {(damageFiles.new || []).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3">
                {damageFiles.new.map((file, index) => (
                  <div key={index}>
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Selected damage"
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                    <p className="max-w-24 truncate text-xs text-slate-400">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold">
              Submit repair request
            </button>
          </form>
        )}

        <h3 className="mb-5 text-xl font-semibold">
          {isCustomer ? 'My repairs' : 'Available repair jobs'}
        </h3>

        <div className="grid gap-5 md:grid-cols-2">
          {repairs.map(repair => (
            <div
              key={repair.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold">
                  {repair.appliance_name}
                </h4>

                <span className="rounded-full bg-blue-950 px-3 py-1 text-xs text-blue-300">
                  {repair.status}
                </span>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-400">
                {repair.problem_description}
              </p>

              <p className="mb-2 text-sm">
                Repair ID: #{repair.id}
              </p>

              {/* CUSTOMER DAMAGE IMAGES */}
              <div className="mb-5 border-t border-slate-800 pt-4">
                <h5 className="font-semibold text-blue-300">
                  Customer damage images
                </h5>

                {renderImages(repair.id, 'customer_damage')}
              </div>

              {/* ESTIMATE DETAILS */}
              {repair.estimated_cost != null && (
                <div className="mb-4 rounded-lg bg-slate-800 p-4">
                  <p className="font-semibold text-green-400">
                    Estimate: ₹{repair.estimated_cost}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    {repair.estimate_description}
                  </p>
                </div>
              )}

              {/* TECHNICIAN CLAIM */}
              {!isCustomer && repair.status === 'reported' && (
                <button
                  onClick={() =>
                    performAction(`/api/repairs/${repair.id}/claim`)
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2"
                >
                  Claim repair
                </button>
              )}

              {/* TECHNICIAN ESTIMATE */}
              {!isCustomer && repair.status === 'claimed' && (
                <div className="space-y-3">
                  <input
                    type="number"
                    min="1"
                    placeholder="Estimate amount (₹)"
                    onChange={e =>
                      setEstimate({
                        ...estimate,
                        [repair.id]: {
                          ...estimate[repair.id],
                          cost: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                  />

                  <textarea
                    placeholder="Describe the proposed repair work"
                    onChange={e =>
                      setEstimate({
                        ...estimate,
                        [repair.id]: {
                          ...estimate[repair.id],
                          description: e.target.value,
                        },
                      })
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

              {/* CUSTOMER APPROVAL */}
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

              {/* TECHNICIAN START REPAIR */}
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

              {/* TECHNICIAN COMPLETION IMAGE UPLOAD */}
              {!isCustomer &&
                ['approved', 'in_progress', 'completed'].includes(repair.status) && (
                  <div className="my-5 border-t border-slate-800 pt-4">
                    <h5 className="mb-3 font-semibold text-green-300">
                      Repair completion images
                    </h5>

                    {renderImages(repair.id, 'repair_completion')}

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={e =>
                        setCompletionFiles({
                          ...completionFiles,
                          [repair.id]: Array.from(e.target.files || []),
                        })
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
                  </div>
                )}

              {/* TECHNICIAN COMPLETE REPAIR */}
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

              {/* CUSTOMER COMPLETION IMAGES */}
              {isCustomer && repair.status === 'completed' && (
                <div className="mb-5 border-t border-slate-800 pt-4">
                  <h5 className="font-semibold text-green-300">
                    Technician repair evidence
                  </h5>

                  {renderImages(repair.id, 'repair_completion')}
                </div>
              )}

              {/* CUSTOMER REVIEW */}
              {isCustomer && repair.status === 'completed' && (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <h5 className="mb-3 font-semibold">
                    Rate your technician
                  </h5>

                  <div className="mb-3 flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        onClick={() =>
                          setReviewForms({
                            ...reviewForms,
                            [repair.id]: {
                              ...reviewForms[repair.id],
                              rating: star,
                            },
                          })
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
                    onChange={e =>
                      setReviewForms({
                        ...reviewForms,
                        [repair.id]: {
                          ...reviewForms[repair.id],
                          comment: e.target.value,
                        },
                      })
                    }
                    className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                  />

                  <button
                    onClick={() => handleReview(repair.id)}
                    className="rounded-lg bg-yellow-600 px-4 py-2 font-semibold"
                  >
                    Submit review
                  </button>

                  {repair.technician_id && ratings[repair.technician_id] && (
                    <p className="mt-3 text-sm text-yellow-300">
                      Technician rating: ★
                      {ratings[repair.technician_id].average_rating}
                      {' '}(
                      {ratings[repair.technician_id].total_reviews}
                      {' '}reviews)
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {repairs.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-8 text-center text-slate-400">
            No repair requests found.
          </p>
        )}
      </main>
    </div>
  )
}
