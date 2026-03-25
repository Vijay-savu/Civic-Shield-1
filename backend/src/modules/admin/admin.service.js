const User = require("../auth/auth.model");
const Application = require("../application/application.model");

function toDecisionCountMap(rows) {
  const map = {
    Eligible: 0,
    "Not Eligible": 0,
    "Needs Review": 0,
    Suspicious: 0,
  };

  rows.forEach((row) => {
    if (map[row._id] !== undefined) {
      map[row._id] = row.count;
    }
  });

  return map;
}

function toSchemeStats(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const schemeName = row._id?.schemeName || "Unknown";
    const decisionStatus = row._id?.decisionStatus || "Unknown";

    if (!grouped.has(schemeName)) {
      grouped.set(schemeName, {
        schemeName,
        total: 0,
        eligible: 0,
        notEligible: 0,
        needsReview: 0,
        suspicious: 0,
      });
    }

    const entry = grouped.get(schemeName);
    entry.total += row.count;

    if (decisionStatus === "Eligible") entry.eligible += row.count;
    if (decisionStatus === "Not Eligible") entry.notEligible += row.count;
    if (decisionStatus === "Needs Review") entry.needsReview += row.count;
    if (decisionStatus === "Suspicious") entry.suspicious += row.count;
  });

  return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
}

async function getAdminOverviewData({ requester }) {
  const [totalUsers, citizenUsers, adminUsers, applicationsCount, decisionRows, schemeRows] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: "citizen" }),
    User.countDocuments({ role: "admin" }),
    Application.countDocuments({}),
    Application.aggregate([
      {
        $group: {
          _id: "$decisionStatus",
          count: { $sum: 1 },
        },
      },
    ]),
    Application.aggregate([
      {
        $group: {
          _id: {
            schemeName: "$schemeName",
            decisionStatus: "$decisionStatus",
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const decisionCounts = toDecisionCountMap(decisionRows);

  return {
    status: "ok",
    reason: "admin_overview_retrieved",
    metrics: {
      totalRegisteredUsers: totalUsers,
      registeredCitizens: citizenUsers,
      registeredAdmins: adminUsers,
      totalApplications: applicationsCount,
      eligibleApplications: decisionCounts.Eligible,
      notEligibleApplications: decisionCounts["Not Eligible"],
      pendingReviewApplications: decisionCounts["Needs Review"],
      suspiciousApplications: decisionCounts.Suspicious,
    },
    schemeStats: toSchemeStats(schemeRows),
    requestedBy: requester?.email || null,
  };
}

module.exports = {
  getAdminOverviewData,
};
