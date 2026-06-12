import { z } from 'zod';

export const ExtractedPracticeSchema = z.object({
  sourceIndex: z.number().int().nonnegative(),
  category: z.enum(['architecture', 'security', 'performance', 'deprecation', 'api', 'testing']),
  practice: z.string().min(10).max(600),
  importance: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
});

export const ExtractionResponseSchema = z.object({
  items: z.array(ExtractedPracticeSchema),
});

export type ExtractedPractice = z.infer<typeof ExtractedPracticeSchema>;
