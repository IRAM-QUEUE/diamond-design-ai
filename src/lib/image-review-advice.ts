import type { ImageReviewConcern } from "@/types/design";

export function imageReviewAdvice(concerns: ImageReviewConcern[], arabic: boolean) {
  if (!concerns.length) return "";
  const lines: string[] = [];
  if (concerns.includes("style")) lines.push(arabic
    ? "قد يختلف هذا التصور عن الأسلوب المختار. تكييف الاسم مع تكوين مترابط وقابل للتصنيع قد يتطلب تعديل نسب الحروف وترتيبها. لمراجعة مدى إمكان التنفيذ، استشر صائغًا؛ ولنتيجة أقرب للمرجع، يمكنك تجربة أسلوب آخر أو اسم مختلف."
    : "This concept may differ from your selected style. Fitting the name into a connected, manufacturable composition can require changes to letter proportions and arrangement. A jeweler can assess feasibility; for a closer match, you could try another style or a different name.");
  if (concerns.includes("lettering")) lines.push(arabic
    ? "لم تؤكد المراجعة تطابق جميع حروف النقش مع طلبك. راجع الاسم والحروف بعناية قبل اعتماد التصور."
    : "The review could not confirm every requested inscription character. Please check the name and lettering carefully before approving the concept.");
  if (concerns.includes("construction")) lines.push(arabic
    ? "قد تحتاج بعض الأجزاء إلى وصلات أو دعامات إضافية. يمكن للصائغ اقتراح تعديلات تحافظ على الطابع الذي تفضله."
    : "Some components may need additional metal connections or support. A jeweler can suggest adjustments that preserve the character you like.");
  if (concerns.includes("unverified")) lines.push(arabic
    ? "لم تتمكن المراجعة الآلية من تأكيد جميع التفاصيل. يبقى التصور متاحًا لك لتقييمه ومراجعته مع صائغ."
    : "The automated review could not verify all details. The concept is still available for you to judge and discuss with a jeweler.");
  lines.push(arabic ? "يمكنك الاحتفاظ بهذا التصور أو طلب تنقيحه؛ هذه ملاحظات إرشادية وليست حكمًا نهائيًا على إمكان تصنيعه." : "You can keep this concept or refine it; these are advisory observations, not a final manufacturing verdict.");
  return lines.join("\n\n");
}
