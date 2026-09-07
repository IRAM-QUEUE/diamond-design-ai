"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Inbox, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orderStatuses, orderStatusLabels, type OrderStatus, type WorkshopOrder } from "@/lib/workshop-orders";

type OrderDetail = { order: WorkshopOrder; pdfUrl: string; imageUrl: string; previewUrl: string };
export function OrdersInbox() {
  const { getAccessToken, user } = useAuth();
  const tokenProvider = useRef(getAccessToken);
  tokenProvider.current = getAccessToken;
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);

  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await tokenProvider.current();
    const response = await fetch(url, { ...options, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The order could not be loaded.");
    return payload;
  }, []);

  const refresh = useCallback(async () => {
    const currentRequest = ++listRequest.current;
    setLoading(true); setError("");
    try {
      const payload = await request(`/api/admin/orders?page=${page}&status=${filter}`);
      if (currentRequest !== listRequest.current) return;
      if (!payload.orders.length && page > 0) { setPage((current) => current - 1); return; }
      setOrders(payload.orders); setTotal(payload.total);
    } catch (issue) {
      if (currentRequest === listRequest.current) setError(issue instanceof Error ? issue.message : "Orders could not be loaded.");
    } finally {
      if (currentRequest === listRequest.current) setLoading(false);
    }
  }, [filter, page, request]);

  useEffect(() => {
    const requestCounter = listRequest;
    void refresh();
    return () => { requestCounter.current++; };
  }, [refresh, user?.id]);

  const openOrder = useCallback(async (id: string) => {
    const currentRequest = ++detailRequest.current;
    setSelectedId(id); setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const payload: OrderDetail = await request(`/api/admin/orders?orderId=${encodeURIComponent(id)}`);
      if (currentRequest !== detailRequest.current) return;
      setDetail(payload);
    } catch (issue) {
      if (currentRequest === detailRequest.current) setDetailError(issue instanceof Error ? issue.message : "Order files could not be loaded.");
    } finally {
      if (currentRequest === detailRequest.current) setDetailLoading(false);
    }
  }, [request]);

  // Renew temporary download links while an order remains open.
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => { if (!savingRef.current) void openOrder(selectedId); }, 240_000);
    return () => window.clearInterval(timer);
  }, [openOrder, selectedId]);

  async function updateStatus(status: OrderStatus) {
    if (!detail || savingRef.current || detail.order.status === status) return;
    savingRef.current = true; setSaving(true); setDetailError("");
    try {
      const payload = await request("/api/admin/orders", {
        method: "PATCH", body: JSON.stringify({ orderId: detail.order.id, status, expectedStatus: detail.order.status })
      });
      setDetail((current) => current ? { ...current, order: payload.order } : null);
      await refresh();
    } catch (issue) {
      setDetailError(issue instanceof Error ? issue.message : "Status could not be saved.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5 text-diamond-champagne" />Orders inbox</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Customer handovers, ready for the workshop.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">Status
            <select aria-label="Filter orders by status" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }} className="rounded-xl border bg-background px-3 py-2 text-white">
              <option value="all">All orders</option>
              {orderStatuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{total} {total === 1 ? "order" : "orders"}</p>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive-foreground">{error}</p> : null}
        {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading orders...</p> : orders.length ? (
          <div className="divide-y rounded-2xl border">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-medium text-white">{order.customer_name} <span className="ml-2 text-xs text-diamond-champagne">{orderStatusLabels[order.status]}</span></p>
                  <p className="break-words text-sm text-muted-foreground">{order.image_name} · {order.reference_id}</p>
                  <p className="break-all text-sm text-muted-foreground">{order.customer_email} · {order.customer_mobile}</p>
                  <p className="text-xs text-muted-foreground">{new Date(order.submitted_at).toLocaleString()}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void openOrder(order.id)}>Open order</Button>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-dashed py-10 text-center text-muted-foreground"><Inbox className="mx-auto mb-3 h-8 w-8" /><p>{filter === "all" ? "No handovers yet" : "No orders with this status"}</p><p className="mt-2 text-sm">Submitted handovers will appear here with both files.</p></div>}
        {total > 20 || page > 0 ? <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={loading || page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button variant="ghost" size="sm" disabled={loading || (page + 1) * 20 >= total} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div> : null}
      </CardContent>
      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open && !savingRef.current) { detailRequest.current++; setSelectedId(null); setDetail(null); } }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>{detail?.order.reference_id ?? "Shop handover"}</DialogTitle>
            <DialogDescription>Review the submitted design, download its files, and update the order status.</DialogDescription>
          </DialogHeader>
          {detailLoading ? <p role="status" className="text-sm text-muted-foreground">Loading handover files...</p> : detail ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <img src={detail.previewUrl} alt={detail.order.image_name} className="aspect-square w-full rounded-2xl border object-contain" onError={() => setDetailError("The image preview could not load. Refresh the files and try again.")} />
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="font-medium text-white">{detail.order.image_name}</p>
                  <p className="text-muted-foreground">{detail.order.customer_name}</p>
                  <p className="break-all text-muted-foreground">{detail.order.customer_email}</p>
                  <p className="text-muted-foreground">{detail.order.customer_mobile}</p>
                  <p className="text-muted-foreground">Submitted {new Date(detail.order.submitted_at).toLocaleString()}</p>
                  <label className="block pt-2 text-muted-foreground">Order status
                    <select aria-label="Order status" value={detail.order.status} disabled={saving} onChange={(event) => void updateStatus(event.target.value as OrderStatus)} className="mt-2 block w-full rounded-xl border bg-background px-3 py-2 text-white">
                      {orderStatuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}
                    </select>
                  </label>
                  {saving ? <p role="status">Saving status...</p> : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild><a href={detail.pdfUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" />Handover PDF</a></Button>
                <Button variant="secondary" asChild><a href={detail.imageUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" />Original image</a></Button>
              </div>
            </div>
          ) : null}
          {detailError ? <p role="alert" className="text-sm text-destructive-foreground">{detailError}</p> : null}
          <Button variant="ghost" size="sm" disabled={detailLoading || saving} onClick={() => { if (selectedId) void openOrder(selectedId); }}><RefreshCw className="h-4 w-4" />Refresh files</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
