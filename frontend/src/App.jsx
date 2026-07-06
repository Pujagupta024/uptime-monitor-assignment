import { useState, useEffect } from 'react'

const API_BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL = 3000;

function RelativeTime({ timestamp }) {
  if (!timestamp) return <span>Never</span>;
  
  const [timeStr, setTimeStr] = useState('');
  
  useEffect(() => {
    const updateTime = () => {
      const date = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
      const seconds = Math.floor((new Date() - date) / 1000);
      
      let str = '';
      if (seconds < 5) str = 'Just now';
      else if (seconds < 60) str = `${seconds}s ago`;
      else if (seconds < 3600) str = `${Math.floor(seconds / 60)}m ago`;
      else str = `${Math.floor(seconds / 3600)}h ago`;
      
      setTimeStr(str);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span>{timeStr}</span>;
}

function AnalyticsModal({ url, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/urls/${url.id}/analytics`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [url.id]);

  if (loading) return null; // Or a spinner

  const maxLatency = data?.recent_latencies?.length 
    ? Math.max(...data.recent_latencies.filter(l => l !== null)) 
    : 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="modal-header">
          <h2 className="modal-title">{url.friendly_name || url.url} - Analytics</h2>
          <span style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>Historical Performance (24h)</span>
        </div>
        
        <div className="metrics-grid">
          <div className="metric-box">
            <div className="metric-box-label">Uptime</div>
            <div className="metric-box-val">{data?.overall_uptime_pct}%</div>
          </div>
          <div className="metric-box">
            <div className="metric-box-label">P95 Latency</div>
            <div className="metric-box-val">{data?.p95_latency_ms ? `${data.p95_latency_ms}ms` : '---'}</div>
          </div>
          <div className="metric-box">
            <div className="metric-box-label">P99 Latency</div>
            <div className="metric-box-val">{data?.p99_latency_ms ? `${data.p99_latency_ms}ms` : '---'}</div>
          </div>
        </div>

        <h3 style={{fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Recent Latency Distribution</h3>
        <div className="chart-container">
          {data?.recent_latencies?.map((lat, idx) => {
            const heightPct = lat ? Math.max((lat / maxLatency) * 100, 2) : 0;
            return (
              <div 
                key={idx} 
                className="chart-bar" 
                style={{height: `${heightPct}%`}}
                title={lat ? `${lat}ms` : 'Timeout/Error'}
              ></div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [urls, setUrls] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(POLL_INTERVAL / 1000);
  const [isValidUrl, setIsValidUrl] = useState(true);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [customHeaders, setCustomHeaders] = useState('');
  const [expectedBodySnippet, setExpectedBodySnippet] = useState('');
  
  const [selectedUrl, setSelectedUrl] = useState(null);

  const fetchUrls = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/urls`);
      if (response.ok) {
        const data = await response.json();
        setUrls(data);
      }
    } catch (err) {
      console.error("Failed to fetch URLs:", err);
    } finally {
      setIsLoading(false);
      setCountdown(POLL_INTERVAL / 1000);
    }
  };

  useEffect(() => {
    fetchUrls();
    const interval = setInterval(fetchUrls, POLL_INTERVAL);
    
    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, []);

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setNewUrl(val);
    if (val === '' || val.startsWith('http://') || val.startsWith('https://')) {
      setIsValidUrl(true);
    } else {
      setIsValidUrl(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newUrl || !isValidUrl) return;

    // Validate JSON on frontend before sending
    if (customHeaders) {
      try {
        JSON.parse(customHeaders);
      } catch (e) {
        alert("Custom Headers must be valid JSON object, e.g. {\"Authorization\": \"Bearer token\"}");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newUrl,
          friendly_name: friendlyName || null,
          http_method: httpMethod,
          custom_headers: customHeaders || null,
          expected_body_snippet: expectedBodySnippet || null
        }),
      });
      if (response.ok) {
        setNewUrl('');
        setFriendlyName('');
        setCustomHeaders('');
        setExpectedBodySnippet('');
        setShowAdvanced(false);
        await fetchUrls();
      } else {
        const err = await response.json();
        alert(err.detail);
      }
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // prevent modal opening
    try {
      const response = await fetch(`${API_BASE_URL}/api/urls/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUrls(urls.filter(u => u.id !== id));
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const parseUrl = (urlString) => {
    try {
      const u = new URL(urlString);
      return { domain: u.hostname, path: u.pathname + u.search };
    } catch {
      return { domain: urlString, path: '' };
    }
  };

  const totalTargets = urls.length;
  const operational = urls.filter(u => u.is_up === true).length;
  const outages = urls.filter(u => u.is_up === false).length;
  const validLatencies = urls.map(u => u.response_time_ms).filter(t => t !== null);
  const avgLatency = validLatencies.length 
    ? Math.round(validLatencies.reduce((a,b) => a+b, 0) / validLatencies.length) 
    : 0;

  return (
    <div className="container">
      {selectedUrl && <AnalyticsModal url={selectedUrl} onClose={() => setSelectedUrl(null)} />}
      
      <header className="header">
        <h1>Uptime Monitor</h1>
        
        <div className="status-summary">
          <div className="summary-card">
            <span className="summary-label">Total Targets</span>
            <span className="summary-value">{isLoading ? '-' : totalTargets}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Operational</span>
            <span className="summary-value" style={{ color: 'var(--color-up)' }}>
              {isLoading ? '-' : operational}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Outages</span>
            <span className={`summary-value ${outages > 0 ? 'outage-alert' : ''}`}>
              {outages > 0 && <div className="outage-pulse"></div>}
              {isLoading ? '-' : outages}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Avg Latency</span>
            <span className="summary-value">{isLoading ? '-' : `${avgLatency}ms`}</span>
          </div>
        </div>

        <div className="form-container" style={{flexDirection: 'column', alignItems: 'center', position: 'relative'}}>
          <form className={`add-url-form ${!isValidUrl ? 'invalid' : ''}`} style={{position: 'relative', zIndex: 10}} onSubmit={handleSubmit}>
            <input 
              type="text" 
              placeholder="https://api.example.com/health"
              value={newUrl}
              onChange={handleUrlChange}
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting || !newUrl || !isValidUrl}>
              {isSubmitting ? 'Adding...' : 'Add Target'}
            </button>
          </form>
          
          <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            Advanced Settings
          </button>
          
          {showAdvanced && (
            <div className="advanced-drawer">
              <div className="drawer-field">
                <span className="drawer-label">Friendly Name</span>
                <input type="text" placeholder="Production API" value={friendlyName} onChange={e => setFriendlyName(e.target.value)} />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">HTTP Method</span>
                <select value={httpMethod} onChange={e => setHttpMethod(e.target.value)}>
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>HEAD</option>
                </select>
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Custom Headers (JSON)</span>
                <input type="text" placeholder='{"Authorization": "Bearer token"}' value={customHeaders} onChange={e => setCustomHeaders(e.target.value)} />
              </div>
              <div className="drawer-field">
                <span className="drawer-label">Expected Body Snippet</span>
                <input type="text" placeholder='"status": "ok"' value={expectedBodySnippet} onChange={e => setExpectedBodySnippet(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        <div className="controls-row">
          <div className="refresh-countdown">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M12 7v5l3 3" />
            </svg>
            Refreshing in {countdown}s
          </div>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Target</th>
                <th>History (Last 10)</th>
                <th>Latency</th>
                <th>Last Checked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="skeleton sk-dot"></div></td>
                    <td>
                      <div className="skeleton sk-text"></div>
                      <div className="skeleton sk-text-sm"></div>
                    </td>
                    <td><div className="skeleton sk-bar"></div></td>
                    <td><div className="skeleton sk-latency"></div></td>
                    <td><div className="skeleton sk-latency"></div></td>
                    <td></td>
                  </tr>
                ))
              ) : urls.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">No targets monitored. Add one above.</div>
                  </td>
                </tr>
              ) : (
                urls.map(url => {
                  const { domain, path } = parseUrl(url.url);
                  let latClass = '';
                  if (url.response_time_ms !== null) {
                    if (url.response_time_ms < 200) latClass = 'lat-good';
                    else if (url.response_time_ms < 1000) latClass = 'lat-warn';
                    else latClass = 'lat-bad';
                  }

                  const history = url.history || [];
                  const padded = [...history];
                  while (padded.length < 10) padded.unshift(null);

                  return (
                    <tr key={url.id} className="clickable-row" onClick={() => setSelectedUrl(url)} title="Click for analytics">
                      <td className="status-cell">
                        <div style={{display: 'flex', alignItems: 'center'}}>
                          <div className={`status-dot ${url.is_up === true ? 'up' : url.is_up === false ? 'down' : 'pending'}`}></div>
                          {url.region && <span className="region-badge">{url.region}</span>}
                        </div>
                      </td>
                      <td className="url-cell">
                        <span className="url-domain" style={{fontWeight: 700}} title={url.friendly_name}>{url.friendly_name}</span>
                        <span className="url-path" style={{fontSize: '0.75rem', opacity: 0.7}} title={url.url}>{url.url}</span>
                      </td>
                      <td>
                        <div className="history-bars" title="Last 10 checks">
                          {padded.map((h, i) => (
                            <div key={i} className={`history-bar ${h === true ? 'up' : h === false ? 'down' : 'empty'}`}></div>
                          ))}
                        </div>
                      </td>
                      <td className="latency-cell">
                        {url.response_time_ms !== null ? (
                          <span className={latClass}>{url.response_time_ms}ms</span>
                        ) : '---'}
                      </td>
                      <td className="time-cell">
                        <RelativeTime timestamp={url.last_ping} />
                      </td>
                      <td>
                        <button className="action-btn" onClick={(e) => handleDelete(e, url.id)} title="Delete target">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
