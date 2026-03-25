import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("civicshield_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function getErrorMessage(error) {
  if (error?.code === "ERR_NETWORK") {
    return "Cannot connect to backend. Start backend on http://localhost:5000";
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.reason ||
    error?.message ||
    "Request failed"
  );
}

export async function loginWithPassword(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data;
}

export async function verifyOtp(payload) {
  const { data } = await api.post("/auth/verify-otp", payload);
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function validateToken() {
  const { data } = await api.get("/secure/token-validate");
  return data;
}

export async function uploadDocument({ file, documentType, ocrHint = "" }) {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("documentType", documentType);
  formData.append("ocrHint", ocrHint);
  const { data } = await api.post("/documents/upload", formData);
  return data;
}

export async function getMyDocuments() {
  const { data } = await api.get("/documents/mine");
  return data;
}

export async function deleteDocument(documentId) {
  const { data } = await api.delete(`/documents/${documentId}`);
  return data;
}

export async function checkEligibility(documentId) {
  const { data } = await api.post(`/verification/check/${documentId}`);
  return data;
}

export async function checkTamper(documentId) {
  const { data } = await api.get(`/check-tamper/${documentId}`);
  return data;
}

export async function getAlerts() {
  const { data } = await api.get("/alerts");
  return data;
}

export async function getAdminLogs() {
  const { data } = await api.get("/admin/logs");
  return data;
}

export async function simulateFailedLogin(payload) {
  const { data } = await api.post("/demo/simulate-failed-login", payload);
  return data;
}

export async function simulateTampering(documentId) {
  const { data } = await api.post(`/demo/simulate-tampering/${documentId}`);
  return data;
}

export async function getLoanRequirements() {
  const { data } = await api.get("/applications/requirements");
  return data;
}

export async function createLoanApplication(payload) {
  const { data } = await api.post("/applications", payload);
  return data;
}

export async function getMyApplications() {
  const { data } = await api.get("/applications/mine");
  return data;
}

export async function getMyApplicationSummary() {
  const { data } = await api.get("/applications/summary");
  return data;
}

export async function getAdminApplications(params = {}) {
  const { data } = await api.get("/applications/admin/list", { params });
  return data;
}

export async function reviewAdminApplication(applicationId, payload) {
  const { data } = await api.patch(`/applications/admin/${applicationId}/review`, payload);
  return data;
}

export { getErrorMessage };
