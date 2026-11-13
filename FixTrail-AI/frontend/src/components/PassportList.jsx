
import { useEffect, useState } from "react";
import { getMyPassports } from "../services/api";

export default function PassportList() {
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPassports() {
      try {
        const data = await getMyPassports();
        setPassports(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unable to load repair passports.");
      } finally {
        setLoading(false);
      }
    }

    loadPassports();
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading repair passports...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (passports.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-center">
        <h3 className="text-lg font-semibold">No Repair Passports Yet</h3>
        <p className="mt-2 text-gray-500">
          Your completed repair records will appear here.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Digital Repair Passport</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {passports.map((passport) => (
          <article
            key={passport.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  {passport.appliance_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {passport.passport_number}
                </p>
              </div>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {passport.repair_status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>Problem:</strong> {passport.problem_description}
              </p>
              <p>
                <strong>Repair performed:</strong>{" "}
                {passport.approved_repair_description}
              </p>
              <p>
                <strong>Approved cost:</strong> ₹
                {Number(passport.approved_cost).toLocaleString("en-IN")}
              </p>
              <p>
                <strong>Technician ID:</strong> {passport.technician_id}
              </p>
              <p>
                <strong>Completed:</strong>{" "}
                {passport.completed_at
                  ? new Date(passport.completed_at).toLocaleDateString("en-IN")
                  : "Not available"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
