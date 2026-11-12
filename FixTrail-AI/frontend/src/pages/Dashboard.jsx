
import { useEffect, useState } from 'react'
import { apiRequest, logout } from '../services/api'

export default function Dashboard({ user, onLogout }) {
  const [repairs, setRepairs] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    appliance_name: '',
    problem_description: '',
  })
  const [estimate, setEstimate] = useState({})

  const isCustomer = user.role === 'customer'

  const loadRepairs = async () => {
    try {
      const endpoint = isCustomer
        ? '/api/repairs/my'
        : '/api/repairs/available'

      const data = await apiRequest(endpoint)
      setRepairs(data)
    } catch (err) {
      setMessage(err.message)
    }
  }

  useEffect(() => {
    loadRepairs()
  }, [])

  const createRepair = async (e) => {
    e.preventDefault()
    setMessage('')

    try {
      await apiRequest('/api/repairs/', {
        method: 'POST',
        body: JSON.stringify(form),
      })

      setForm({
        appliance_name: '',
        problem_description: '',
      })

      setMessage('Repair request submitted successfully!')
      loadRepairs()
    } catch (err) {
      setMessage(err.message)
    }
  }

  const performAction = async (path, method = 'POST', body = null) => {
    setMessage('')

    try {
      await apiRequest(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      })

      setMessage('Action completed successfully!')
      loadRepairs()
    } catch (err) {
      setMessage(err.message)
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

  return (
    <div className="min-h-screen">
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
              onChange={(e) =>
                setForm({ ...form, appliance_name: e.target.value })
              }
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />

            <textarea
              required
              minLength={10}
              placeholder="Describe the problem..."
              value={form.problem_description}
              onChange={(e) =>
                setForm({ ...form, problem_description: e.target.value })
              }
              className="mb-4 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />

            <button className="rounded-lg bg-blue-600 px-5 py-3 font-semibold">
              Submit repair request
            </button>
          </form>
        )}

        <h3 className="mb-5 text-xl font-semibold">
          {isCustomer ? 'My repairs' : 'Available repair jobs'}
        </h3>

        <div className="grid gap-5 md:grid-cols-2">
          {repairs.map((repair) => (
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

              {repair.estimated_cost != null && (
                <div className="mb-4">
                  <p className="font-semibold text-green-400">
                    Estimate: ₹{repair.estimated_cost}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {repair.estimate_description}
                  </p>
                </div>
              )}

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

              {!isCustomer && repair.status === 'claimed' && (
                <div className="space-y-3">
                  <input
                    type="number"
                    min="1"
                    placeholder="Estimate amount (₹)"
                    onChange={(e) =>
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
                    onChange={(e) =>
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
