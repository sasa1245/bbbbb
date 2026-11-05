export const SUBJECTS: { key: string; label: string; hue: number }[] = [
  { key: "physics", label: "فيزياء", hue: 250 },
  { key: "chemistry", label: "كيمياء", hue: 150 },
  { key: "biology", label: "أحياء", hue: 135 },
  { key: "math", label: "رياضيات", hue: 220 },
  { key: "philosophy", label: "فلسفة", hue: 300 },
  { key: "science", label: "علوم", hue: 175 },
  { key: "social", label: "دراسات", hue: 60 },
  { key: "history", label: "تاريخ", hue: 40 },
  { key: "geography", label: "جغرافيا", hue: 95 },
  { key: "psychology", label: "علم نفس", hue: 330 },
  { key: "english", label: "إنجليزي", hue: 20 },
  { key: "arabic", label: "عربي", hue: 160 },
  { key: "other", label: "أخرى", hue: 190 },
];

export function subjectInfo(key?: string | null) {
  return SUBJECTS.find((s) => s.key === key) ?? SUBJECTS[SUBJECTS.length - 1]!;
}

/** CSS variables that re-tint the exam screen to the teacher's subject. */
export function subjectThemeVars(key?: string | null): Record<string, string> {
  const h = subjectInfo(key).hue;
  return {
    "--primary": `oklch(0.48 0.12 ${h})`,
    "--ring": `oklch(0.6 0.12 ${h})`,
    "--accent": `oklch(0.95 0.03 ${h})`,
    "--accent-foreground": `oklch(0.3 0.08 ${h})`,
  };
}

export const TEMPLATES = [
  { key: "classic", label: "كلاسيكي — كل الأسئلة", paged: false },
  { key: "single", label: "سؤال في كل صفحة", paged: true },
  { key: "cards", label: "بطاقات", paged: false },
  { key: "focus", label: "تركيز — سؤال كبير", paged: true },
  { key: "compact", label: "مضغوط", paged: false },
  { key: "notebook", label: "كراسة", paged: false },
] as const;

export const QTYPE_LABELS: Record<string, string> = {
  mcq: "اختيار متعدد",
  tf: "صح / خطأ",
  fill: "أكمل",
  essay: "مقالي",
  match: "توصيل",
  order: "ترتيب",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  scheduled: "مجدول",
  active: "نشط",
  closed: "مغلق",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
  suspended: "موقوف",
};
