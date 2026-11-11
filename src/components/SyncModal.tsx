"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

interface EnvConfig {
  hasCredentials: boolean;
  hasToken: boolean;
  emailMasked: string | null;
  apiUrl: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [useToken, setUseToken] = useState(false);
  const [maxPages, setMaxPages] = useState(3);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);

  // Check backend environment status whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setEnvConfig(data);
        }
      })
      .catch((err) => {
        console.warn("Could not check /api/auth status:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasEnv = !!envConfig?.hasCredentials;
  const isUsingEnvDefaults = !useToken && !email.trim() && !password;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Authenticating with Qogita API...");

    try {
      const payload: Record<string, unknown> = { maxPages };
      if (useToken) {
        if (token.trim()) {
          payload.token = token.trim();
        } else if (!hasEnv) {
          throw new Error("Please enter a JWT Access Token");
        }
      } else {
        if (email.trim()) payload.email = email.trim();
        if (password) payload.password = password;

        if (!hasEnv && (!email.trim() || !password)) {
          throw new Error(
            "Please provide an email and password, or configure QOGITA_EMAIL and QOGITA_PASSWORD in .env.local"
          );
        }
      }

      setStatusMessage("Fetching products and multi-supplier variant offers...");
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }

      setStatusMessage(
        data.message || `Successfully synced ${data.totalSynced} offers!`
      );
      setTimeout(() => {
        onSyncComplete();
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sync failed");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Live Qogita API Catalog Sync
            </h3>
            <p className="text-xs text-slate-500">
              Pulls live offers, Supplier Allocation IDs, and MOVs directly from Qogita.
            </p>
          </div>
        </div>

        {hasEnv ? (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-900">
                Environment Credentials Detected
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Active in <code>.env.local</code>:{" "}
                <span className="font-mono font-medium">
                  {envConfig?.emailMasked || "Configured"}
                </span>
                . You can leave the inputs below blank to use them, or fill them to override.
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-900">
                No saved credentials in .env.local
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Enter your Qogita credentials below, or save{" "}
                <code>QOGITA_EMAIL</code> & <code>QOGITA_PASSWORD</code> into{" "}
                <code>.env.local</code>.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSync} className="space-y-4">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100">
            <span className="font-medium text-slate-600">Auth Method</span>
            <button
              type="button"
              onClick={() => setUseToken(!useToken)}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {useToken ? "Use Email / Password" : "Use JWT Bearer Token"}
            </button>
          </div>

          {useToken ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Qogita JWT Access Token
              </label>
              <textarea
                required={!hasEnv}
                rows={3}
                placeholder={
                  hasEnv
                    ? "Leave blank to use environment credentials, or paste JWT (ey...)"
                    : "ey..."
                }
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qogita Account Email
                  {hasEnv && (
                    <span className="ml-1 text-[11px] font-normal text-slate-400">
                      (Optional - defaults to .env.local)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required={!hasEnv}
                    placeholder={
                      hasEnv && envConfig?.emailMasked
                        ? `Using ${envConfig.emailMasked}`
                        : "buyer@example.com"
                    }
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qogita Password
                  {hasEnv && (
                    <span className="ml-1 text-[11px] font-normal text-slate-400">
                      (Optional - defaults to .env.local)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required={!hasEnv}
                    placeholder={hasEnv ? "•••••••• (from .env.local)" : "••••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Pages to Fetch (20 products/page)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                ~{maxPages * 20} products
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="200"
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <div className="flex items-center gap-1 shrink-0">
                {[5, 20, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMaxPages(p)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      maxPages === p
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p} pgs
                  </button>
                ))}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Syncing...
                </>
              ) : isUsingEnvDefaults && hasEnv ? (
                "Start Sync (.env.local)"
              ) : (
                "Start Sync"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
