export function calculateSatisfactionScore(
  eventManagerRating: number | null | undefined,
  woRating: number | null | undefined,
  ballroomFacilitiesRating: number | null | undefined,
  ballroomCleanlinessRating: number | null | undefined,
  vendorsRating: number | null | undefined,
  salesRating: number | null | undefined,
  projectManagers: Array<{ rating?: number | null | undefined }> = []
): number | null {
  const ratings: number[] = [];

  if (eventManagerRating) ratings.push(eventManagerRating);
  if (woRating) ratings.push(woRating);
  if (ballroomFacilitiesRating) ratings.push(ballroomFacilitiesRating);
  if (ballroomCleanlinessRating) ratings.push(ballroomCleanlinessRating);
  if (vendorsRating) ratings.push(vendorsRating);
  if (salesRating) ratings.push(salesRating);

  projectManagers.forEach((pm) => {
    if (pm.rating) ratings.push(pm.rating);
  });

  if (ratings.length === 0) return null;

  const sum = ratings.reduce((a, b) => a + b, 0);
  return sum / ratings.length;
}

export function calculateAllowance(satisfactionScore: number | null): {
  percentage: number | null;
  nominal: number | null;
} {
  if (satisfactionScore === null) {
    return { percentage: null, nominal: null };
  }

  if (satisfactionScore >= 3.6) {
    return { percentage: 100, nominal: 1000000 };
  }
  if (satisfactionScore >= 3.1) {
    return { percentage: 80, nominal: 800000 };
  }
  if (satisfactionScore >= 2.1) {
    return { percentage: 60, nominal: 600000 };
  }
  if (satisfactionScore >= 1.1) {
    return { percentage: 30, nominal: 300000 };
  }
  return { percentage: 0, nominal: 0 };
}
