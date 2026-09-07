export const workshopOrdersBucket = "workshop-orders";
export const orderStatuses = ["new", "viewed", "in_progress", "completed"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "New", viewed: "Viewed", in_progress: "In progress", completed: "Completed"
};
export type WorkshopOrder = {
  id: string;
  reference_id: string;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  image_name: string;
  status: OrderStatus;
  submitted_at: string;
};
export const workshopPdfPath = (id: string) => `${id}/handover.pdf`;
export const workshopImagePath = (id: string) => `${id}/final-image.png`;
