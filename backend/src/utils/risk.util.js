function calculateRiskScore(failedAttempts) {
  const attempts = Number(failedAttempts) || 0;

  if (attempts >= 5) {
    return "High";
  }

  if (attempts >= 3) {
    return "Medium";
  }

  return "Low";
}

function maxRiskScore(...scores) {
  const rank = {
    Low: 1,
    Medium: 2,
    High: 3,
  };

  let highest = "Low";

  for (const score of scores) {
    if (rank[score] && rank[score] > rank[highest]) {
      highest = score;
    }
  }

  return highest;
}

module.exports = {
  calculateRiskScore,
  maxRiskScore,
};
