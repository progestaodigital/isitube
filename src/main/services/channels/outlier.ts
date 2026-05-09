export type OutlierInput = {
  id: string;
  viewCount: number;
};

export type OutlierAssessment = {
  channelAvgViews: number;
  thresholdPercent: number;
  flagged: Array<{
    id: string;
    outlierPercent: number; // (views / avg) * 100
    flaggedAsOutlier: boolean;
    channelAvgViewsAtCheck: number;
  }>;
};

/**
 * Compute the channel's average view count and flag each video that exceeds
 * the configured threshold (default 150% of the average). When the channel
 * has fewer than 3 videos, no flags are emitted — there is no meaningful
 * baseline yet.
 */
export function assessOutliers(
  videos: OutlierInput[],
  thresholdPercent: number
): OutlierAssessment {
  if (videos.length < 3) {
    return {
      channelAvgViews: 0,
      thresholdPercent,
      flagged: videos.map((v) => ({
        id: v.id,
        outlierPercent: 0,
        flaggedAsOutlier: false,
        channelAvgViewsAtCheck: 0,
      })),
    };
  }

  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const avg = totalViews / videos.length;

  const flagged = videos.map((v) => {
    const pct = avg > 0 ? (v.viewCount / avg) * 100 : 0;
    return {
      id: v.id,
      outlierPercent: pct,
      flaggedAsOutlier: avg > 0 && pct >= thresholdPercent,
      channelAvgViewsAtCheck: Math.round(avg),
    };
  });

  return {
    channelAvgViews: Math.round(avg),
    thresholdPercent,
    flagged,
  };
}
