import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TStats } from "../types/stats";

export const getStats = reactCache(
  (environmentId: string, statsFrom?: Date): Promise<TStats> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId]);
        try {
          const groupedResponesPromise = prisma.response.groupBy({
            by: ["surveyId"],
            _count: {
              surveyId: true,
            },
            where: {
              survey: {
                environmentId,
              },
              createdAt: {
                gte: statsFrom,
              },
            },
          });

          const groupedSentimentsPromise = prisma.document.groupBy({
            by: ["sentiment"],
            _count: {
              sentiment: true,
            },
            where: {
              survey: {
                environmentId,
              },
              createdAt: {
                gte: statsFrom,
              },
            },
          });

          const [groupedRespones, groupedSentiments] = await Promise.all([
            groupedResponesPromise,
            groupedSentimentsPromise,
          ]);

          const activeSurveys = groupedRespones.length;

          const newResponses = groupedRespones.reduce((acc, { _count }) => acc + _count.surveyId, 0);

          const sentimentCounts = groupedSentiments.reduce(
            (acc, { sentiment, _count }) => {
              acc[sentiment] = _count.sentiment;
              return acc;
            },
            {
              positive: 0,
              negative: 0,
              neutral: 0,
            }
          );

          // analysed feedbacks is the sum of all the sentiments
          const analysedFeedbacks = Object.values(sentimentCounts).reduce((acc, count) => acc + count, 0);

          let positivePercentage: number = 0,
            negativePercentage: number = 0,
            overallSentiment: TStats["overallSentiment"];

          if (sentimentCounts.positive || sentimentCounts.negative) {
            positivePercentage =
              sentimentCounts.positive / (sentimentCounts.positive + sentimentCounts.negative);

            negativePercentage =
              sentimentCounts.negative / (sentimentCounts.positive + sentimentCounts.negative);

            overallSentiment = positivePercentage >= negativePercentage ? "positive" : "negative";
          }

          return {
            newResponses,
            activeSurveys,
            analysedFeedbacks,
            sentimentScore: Math.max(positivePercentage, negativePercentage),
            overallSentiment,
          };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`stats-${environmentId}-${statsFrom}`],
      {
        tags: [environmentCache.tag.byId(environmentId)],
      }
    )()
);