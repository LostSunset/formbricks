import "server-only";
import { embed } from "ai";
import { prisma } from "@formbricks/database";
import { TInsightCategory } from "@formbricks/types/insights";
import { embeddingsModel } from "../aiModels";
import { createInsight, findNearestInsights } from "../insight/service";
import { getInsightVectorText } from "../insight/utils";
import { documentCache } from "./cache";

export const getQuestionResponseReferenceId = (surveyId: string, questionId: string) => {
  return `${surveyId}-${questionId}`;
};

export const handleInsightAssignments = async (
  environmentId: string,
  documentId: string,
  insight: {
    title: string;
    description: string;
    category: TInsightCategory;
  }
) => {
  // create embedding for insight
  const { embedding } = await embed({
    model: embeddingsModel,
    value: getInsightVectorText(insight.title, insight.description),
    experimental_telemetry: { isEnabled: true },
  });
  // find close insight to merge it with
  const nearestInsights = await findNearestInsights(environmentId, embedding, 1, 0.35);

  if (nearestInsights.length > 0) {
    // create a documentInsight with this insight
    await prisma.documentInsight.create({
      data: {
        documentId,
        insightId: nearestInsights[0].id,
      },
    });
    documentCache.revalidate({
      insightId: nearestInsights[0].id,
    });
  } else {
    // create new insight and documentInsight
    const newInsight = await createInsight({
      environmentId: environmentId,
      title: insight.title,
      description: insight.description,
      category: insight.category,
      vector: embedding,
    });
    // create a documentInsight with this insight
    await prisma.documentInsight.create({
      data: {
        documentId,
        insightId: newInsight.id,
      },
    });
    documentCache.revalidate({
      insightId: newInsight.id,
    });
  }
};
