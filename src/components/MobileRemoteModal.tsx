import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Wifi, Copy, Check, X, Smartphone, Globe, ShieldCheck } from 'lucide-react';
import type { RemoteServerInfo } from '../types/electron';

interface MobileRemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedCount?: number;
  onSwitchToRemote?: () => void;
}

export const MobileRemoteModal: React.FC<MobileRemoteModalProps> = ({
  isOpen,
  onClose,
  connectedCount = 0,
  onSwitchToRemote,
}) => {
  const [serverInfo, setServerInfo] = useState<RemoteServerInfo | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedUrl, setSelectedUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const fetchInfo = async () => {
      let info: RemoteServerInfo | null = null;
      if (window.electronAPI?.getRemoteInfo) {
        try {
          info = await window.electronAPI.getRemoteInfo();
        } catch (e) {
          console.warn('Failed to get remote info via electronAPI:', e);
        }
      }

      if (!info) {
        // Fallback to HTTP API
        try {
          const res = await fetch('/api/network-info');
          if (res.ok) {
            info = await res.json();
          }
        } catch {
          // If in vite dev server without Electron, construct from window.location
          const host = window.location.hostname || 'localhost';
          const port = window.location.port ? parseInt(window.location.port, 10) : 3456;
          info = {
            active: true,
            port,
            primaryIp: host,
            primaryUrl: `${window.location.protocol}//${host}:${port}`,
            ipAddresses: [{ iface: 'current', ip: host, url: `${window.location.protocol}//${host}:${port}` }],
            clientsCount: connectedCount,
          };
        }
      }

      if (active && info) {
        setServerInfo(info);
        const urlToUse = info.primaryUrl || (info.ipAddresses?.[0]?.url ?? '');
        setSelectedUrl(urlToUse);

        if (urlToUse) {
          try {
            const dataUrl = await QRCode.toDataURL(urlToUse, {
              width: 260,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
            if (active) setQrCodeDataUrl(dataUrl);
          } catch (qrErr) {
            console.error('Failed to generate QR code:', qrErr);
          }
        }
      }
    };

    fetchInfo();

    return () => {
      active = false;
    };
  }, [isOpen, connectedCount]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!selectedUrl) return;
    navigator.clipboard.writeText(selectedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleUrlChange = async (url: string) => {
    setSelectedUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="remote-modal-backdrop" onClick={onClose}>
      <div
        className="remote-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="remote-modal-header">
          <div className="remote-header-title">
            <div className="remote-icon-badge">
              <Smartphone size={20} className="icon-pulse" />
            </div>
            <div>
              <h3>MOBILE REMOTE CONTROL</h3>
              <p className="remote-header-sub">
                Control this stage timer in real time from any phone or tablet
              </p>
            </div>
          </div>
          <button
            type="button"
            className="remote-close-btn"
            onClick={onClose}
            title="Close modal (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="remote-modal-body">
          {/* QR Code Container */}
          <div className="remote-qr-section">
            <div className="qr-wrapper">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Scan to open Stage Timer Remote"
                  className="qr-image"
                />
              ) : (
                <div className="qr-skeleton">Generating QR Code...</div>
              )}
            </div>
            <span className="qr-scan-hint">
              Point your phone camera at the QR code to connect instantly
            </span>
          </div>

          {/* Connection URL and Options */}
          <div className="remote-info-section">
            <div className="remote-status-pill">
              <span className="live-dot" />
              <span>
                SERVER ONLINE · PORT {serverInfo?.port || 3456} ·{' '}
                {serverInfo?.clientsCount || connectedCount} DEVICE(S) CONNECTED
              </span>
            </div>

            <div className="remote-url-box">
              <div className="url-label-row">
                <span className="url-label">DIRECT PHONE BROWSER URL:</span>
                <span className="url-hint">Type into Chrome, Safari, or Brave</span>
              </div>
              <div className="url-input-group">
                <input
                  type="text"
                  readOnly
                  value={selectedUrl}
                  className="url-display-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  className="url-copy-btn"
                  onClick={handleCopy}
                  title="Copy link to clipboard"
                >
                  {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                  <span>{copied ? 'COPIED!' : 'COPY'}</span>
                </button>
              </div>
            </div>

            {/* If multiple network interfaces detected (Wi-Fi, Ethernet, Hotspot) */}
            {serverInfo && serverInfo.ipAddresses && serverInfo.ipAddresses.length > 1 && (
              <div className="multi-ip-select">
                <span className="ip-select-label">AVAILABLE NETWORK ADAPTERS:</span>
                <div className="ip-chips-list">
                  {serverInfo.ipAddresses.map((net) => {
                    const isSelected = selectedUrl === net.url;
                    return (
                      <button
                        key={net.ip}
                        type="button"
                        className={`ip-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => handleUrlChange(net.url)}
                      >
                        <Globe size={12} />
                        <span>
                          {net.iface}: {net.ip}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="remote-instructions-card">
              <div className="instruct-item">
                <Wifi size={16} className="instruct-icon" />
                <div className="instruct-text">
                  <strong>Same Wi-Fi or Hotspot Required:</strong> Make sure your mobile phone is
                  connected to the same Wi-Fi router as this laptop, OR connect the phone directly
                  to this laptop's personal hotspot.
                </div>
              </div>
              <div className="instruct-item">
                <ShieldCheck size={16} className="instruct-icon" />
                <div className="instruct-text">
                  <strong>Zero Install / Zero Login:</strong> No app store download needed. Works
                  immediately in any phone browser with ultra-low latency bi-directional sync.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="remote-modal-footer">
          {onSwitchToRemote && (
            <button
              type="button"
              className="material-btn btn-secondary"
              onClick={() => {
                onClose();
                onSwitchToRemote();
              }}
            >
              Preview Mobile Remote
            </button>
          )}
          <button
            type="button"
            className="material-btn btn-secondary"
            onClick={() => {
              if (selectedUrl) {
                window.open(selectedUrl, '_blank');
              }
            }}
          >
            Open in Browser Tab
          </button>
          <button type="button" className="material-btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
