import { describe, it, expect } from "vitest";
import { normalizeArabic, scoreExam, finalScore, gradeLabel, type Question } from "./scoring";

describe("scoring", () => {
  it("normalizes hamza, taa marbuta and yaa", () => {
    expect(normalizeArabic("  أحمد   إلى مدرسة ")).toBe(normalizeArabic("احمد الي مدرسه"));
  });

  it("fill answers match despite hamza spelling", () => {
    const q: Question[] = [{ id: "a", type: "fill", text: "", points: 2, correct: "الإسكندرية" }];
    expect(scoreExam(q, { a: "الاسكندريه" }).auto).toBe(2);
  });

  it("essay keeps final score pending until graded", () => {
    const q: Question[] = [
      { id: "m", type: "mcq", text: "", points: 4, options: ["a", "b"], correct: 1 },
      { id: "e", type: "essay", text: "", points: 6 },
    ];
    const r = scoreExam(q, { m: 1 });
    expect(r).toEqual({ auto: 4, max: 10, hasEssay: true });
    expect(finalScore(q, r.auto, {})).toBeNull();
    expect(finalScore(q, r.auto, { e: 50 })).toBe(7);
    expect(finalScore(q, r.auto, { e: 50 }, true)).toBe(0);
  });

  it("grade thresholds", () => {
    expect(gradeLabel(85)).toBe("ممتاز");
    expect(gradeLabel(75)).toBe("جيد جداً");
    expect(gradeLabel(60)).toBe("جيد");
    expect(gradeLabel(40)).toBe("مقبول");
    expect(gradeLabel(39)).toBe("ضعيف");
  });
});
