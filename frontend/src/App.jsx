import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Popup,
  useMap
} from 'react-leaflet';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { 
  Map as MapIcon, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Download, 
  Activity, 
  Calendar, 
  Users, 
  BarChart2, 
  Info,
  ChevronRight,
  Navigation
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000/api";

// Helper component to center map on coordinates
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Custom Apple Fitness style SVG Activity Rings for Precinct Analysis
function PrecinctActivityRings({ approvalRate = 0.75, resolutionCompliance = 0.65, activityRate = 0.85 }) {
  const [hoveredRing, setHoveredRing] = useState(null);

  const size = 180;
  const strokeWidth = 14;
  const center = size / 2;
  
  const rings = [
    {
      id: "approval",
      label: "Approval Rate",
      value: approvalRate,
      color: "var(--system-teal)",
      radius: 70,
      circumference: 2 * Math.PI * 70,
    },
    {
      id: "resolution",
      label: "Resolution compliance",
      value: resolutionCompliance,
      color: "var(--system-indigo)",
      radius: 52,
      circumference: 2 * Math.PI * 52,
    },
    {
      id: "activity",
      label: "Patrol Compliance",
      value: activityRate,
      color: "var(--system-orange)",
      radius: 34,
      circumference: 2 * Math.PI * 34,
    }
  ];

  const getDisplayValue = () => {
    if (hoveredRing) {
      const match = rings.find(r => r.id === hoveredRing);
      return {
        percent: `${(match.value * 100).toFixed(0)}%`,
        label: match.label
      };
    }
    return {
      percent: `${(approvalRate * 100).toFixed(0)}%`,
      label: "Avg Approval"
    };
  };

  const display = getDisplayValue();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0', gap: '1rem', width: '100%' }}>
      <div className="activity-ring-container" style={{ width: size, height: size, flexShrink: 0 }}>
        <svg className="activity-ring" width={size} height={size}>
          {rings.map((ring) => {
            const offset = ring.circumference - (ring.value * ring.circumference);
            return (
              <g key={ring.id} 
                 onMouseEnter={() => setHoveredRing(ring.id)}
                 onMouseLeave={() => setHoveredRing(null)}
                 style={{ cursor: 'pointer' }}
              >
                {/* Background Ring */}
                <circle
                  className="activity-ring-bg"
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  strokeWidth={strokeWidth}
                />
                {/* Active Progress Ring */}
                <circle
                  className="activity-ring-progress"
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  strokeWidth={strokeWidth}
                  stroke={ring.color}
                  strokeDasharray={ring.circumference}
                  strokeDashoffset={offset}
                  style={{
                    transformOrigin: '50% 50%',
                    filter: hoveredRing === ring.id ? `drop-shadow(0 0 6px ${ring.color})` : 'none',
                    opacity: hoveredRing && hoveredRing !== ring.id ? 0.3 : 1,
                    transition: 'all 0.3s ease'
                  }}
                />
              </g>
            );
          })}
        </svg>
        <div className="activity-ring-label" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{display.percent}</span>
          <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginTop: '2px', textAlign: 'center', maxWidth: '80px', lineHeight: '1.2' }}>{display.label}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem', flexGrow: 1 }}>
        {rings.map(ring => (
          <div 
            key={ring.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.6rem', 
              cursor: 'pointer',
              opacity: hoveredRing && hoveredRing !== ring.id ? 0.4 : 1,
              transition: 'opacity 0.2s ease',
              padding: '0.25rem 0.5rem',
              borderRadius: '8px',
              backgroundColor: hoveredRing === ring.id ? 'rgba(255,255,255,0.03)' : 'transparent'
            }}
            onMouseEnter={() => setHoveredRing(ring.id)}
            onMouseLeave={() => setHoveredRing(null)}
          >
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ring.color, flexShrink: 0 }}></span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {ring.label}: <strong style={{ color: 'var(--text-primary)' }}>{(ring.value * 100).toFixed(0)}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// BTP Flowchart pipeline component
function PipelineFlowchart() {
  const steps = [
    {
      id: 1,
      title: "Data Feed Ingest",
      desc: "Violations logs & CSV upload",
      icon: Download,
      color: "var(--system-blue)"
    },
    {
      id: 2,
      title: "DBSCAN Clustering",
      desc: "Spatial grouping (ε=150m)",
      icon: Activity,
      color: "var(--system-teal)"
    },
    {
      id: 3,
      title: "Risk Priority Scoring",
      desc: "Weighting congestion impact",
      icon: AlertTriangle,
      color: "var(--system-orange)"
    },
    {
      id: 4,
      title: "Enforcement Audit",
      desc: "Flagging gap zones (<60%)",
      icon: ShieldAlert,
      color: "var(--system-red)"
    },
    {
      id: 5,
      title: "Shift Officer Dispatch",
      desc: "Optimized patrol scheduling",
      icon: Navigation,
      color: "var(--system-indigo)"
    }
  ];

  return (
    <div className="card card-animate delay-3" style={{ width: '100%' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <h3 className="card-title">
          <Activity size={16} style={{ color: 'var(--system-blue)' }} /> BTP Intelligent Enforcement Pipeline
        </h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
        End-to-end data processing workflow. AI models automatically compile spatial coordinate streams, clusters offences, grades congestion levels, and assigns officers.
      </p>

      {/* SVG-based Connected Flowchart for Precision */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', padding: '0.5rem 0' }}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                {/* Node Box */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, minWidth: '120px', flex: 1 }}>
                  <div 
                    style={{ 
                      width: '42px', 
                      height: '42px', 
                      borderRadius: '50%', 
                      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                      border: `1px solid rgba(255, 255, 255, 0.08)`, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: step.color,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.borderColor = step.color;
                      e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.65rem', textAlign: 'center' }}>
                    {step.title}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem', textAlign: 'center', maxWidth: '105px', lineHeight: '1.2' }}>
                    {step.desc}
                  </span>
                </div>

                {/* Animated Line Connector (if not the last step) */}
                {idx < steps.length - 1 && (
                  <div style={{ flexGrow: 1, height: '4px', display: 'flex', alignItems: 'center', margin: '0 -15px', zIndex: 1, minWidth: '35px' }}>
                    <svg width="100%" height="4" style={{ overflow: 'visible' }}>
                      <line 
                        x1="0%" 
                        y1="2" 
                        x2="100%" 
                        y2="2" 
                        stroke="rgba(255, 255, 255, 0.06)" 
                        strokeWidth="2" 
                      />
                      <line 
                        x1="0%" 
                        y1="2" 
                        x2="100%" 
                        y2="2" 
                        stroke={step.color} 
                        strokeWidth="2" 
                        className="pipeline-flow-line" 
                        style={{ opacity: 0.8 }}
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Zone Intelligence");
  const [stats, setStats] = useState({
    total_cases: 0,
    approved: 0,
    rejected: 0,
    avg_approval_rate: 0,
    hotspots_count: 0,
    enforcement_gaps: 0,
    highest_risk_zone: null
  });
  const [hotspots, setHotspots] = useState([]);
  const [violations, setViolations] = useState([]);
  const [shifts, setShifts] = useState({});
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [stationData, setStationData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial global data
  useEffect(() => {
    async function fetchGlobalData() {
      try {
        setLoading(true);
        const statsRes = await fetch(`${API_BASE}/stats`);
        const statsData = await statsRes.json();
        setStats(statsData);

        const hotspotsRes = await fetch(`${API_BASE}/hotspots`);
        const hotspotsData = await hotspotsRes.json();
        setHotspots(hotspotsData);

        const violationsRes = await fetch(`${API_BASE}/violations`);
        const violationsData = await violationsRes.json();
        setViolations(violationsData);

        const shiftsRes = await fetch(`${API_BASE}/shifts`);
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData);

        const stationsRes = await fetch(`${API_BASE}/stations`);
        const stationsData = await stationsRes.json();
        setStations(stationsData);
        if (stationsData.length > 0) {
          setSelectedStation(stationsData[0]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchGlobalData();
  }, []);

  // Fetch station data when selected station changes
  useEffect(() => {
    if (!selectedStation) return;
    async function fetchStationDetails() {
      try {
        const res = await fetch(`${API_BASE}/station/${selectedStation}`);
        const data = await res.json();
        setStationData(data);
      } catch (err) {
        console.error("Error fetching station details:", err);
      }
    }
    fetchStationDetails();
  }, [selectedStation]);

  // Download hotspots CSV helper
  const downloadCSV = () => {
    if (hotspots.length === 0) return;
    const headers = ["Zone ID", "Risk Score", "Cases", "Approval Rate", "Gap Flagged", "Primary Offence", "Peak Hour", "Nearest Station", "Latitude", "Longitude"];
    const rows = hotspots.map(h => [
      h.cluster_id,
      h.congestion_score,
      h.violation_count,
      h.approval_rate,
      h.enforcement_gap_flag ? "TRUE" : "FALSE",
      h.top_violation,
      h.peak_hour,
      h.top_police_station,
      h.lat,
      h.lon
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enforcement_zones_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getViolationColor = (type) => {
    switch (type) {
      case "No Parking": return "var(--system-orange)";
      case "Wrong Side": return "var(--system-red)";
      case "Obstruction": return "var(--system-blue)";
      default: return "var(--system-teal)";
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#07090e', color: '#06b6d4', fontSize: '1.5rem', fontWeight: 600 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Activity size={48} className="animate-pulse" />
          <span>BTP Enforcement Intelligence Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Background Glowing Blobs for Materiality */}
      <div className="glow-bg-container">
        <div className="glow-blob blob-blue"></div>
        <div className="glow-blob blob-indigo"></div>
        <div className="glow-blob blob-teal"></div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <span className="logo-title">BTP ENFORCEMENT</span>
          <span className="logo-subtitle">GRIDLOCK TRACK-1</span>
        </div>
        <div className="divider"></div>
        <ul className="nav-list">
          {[
            { id: "Zone Intelligence", icon: MapIcon },
            { id: "Risk Scoring", icon: BarChart2 },
            { id: "Shift Deployment", icon: Clock },
            { id: "Station Analysis", icon: ShieldAlert },
            { id: "MapmyIndia View", icon: Navigation }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <li 
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                {tab.id}
              </li>
            );
          })}
        </ul>
        <div className="sidebar-footer">
          <p>BTP × Gridlock 2.0</p>
          <p>Data: Jan–May 2024</p>
          <p style={{ marginTop: '4px' }}>Operational dashboard built for Bangalore traffic enforcement prioritization</p>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">{activeTab}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Real-time spatial clustering and congestion forecasting dashboard
            </p>
          </div>
          {activeTab === "Risk Scoring" && (
            <button className="btn-download" onClick={downloadCSV}>
              <Download size={16} />
              Export Zone Details
            </button>
          )}
        </div>

        {/* Dynamic page contents wrapped in transition container */}
        <div key={activeTab} className="tab-transition-container">
          {/* Global metrics ribbon (visible across most tabs) */}
          {activeTab !== "Station Analysis" && (
            <section className="metrics-grid">
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Total Parking Cases</span>
                <span className="metric-value">{stats.total_cases.toLocaleString()}</span>
                <span className="metric-subtext">Jan - May 2024</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Hotspot Clusters</span>
                <span className="metric-value">{stats.hotspots_count}</span>
                <span className="metric-subtext">DBSCAN (ε=150m, Min=5)</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Enforcement Gaps</span>
                <span className="metric-value" style={{ color: stats.enforcement_gaps > 0 ? 'var(--system-red)' : 'var(--text-primary)' }}>
                  {stats.enforcement_gaps}
                </span>
                <span className="metric-subtext">Approval Rate &lt; 60%</span>
              </div>
              <div className="card metric-card card-animate delay-1">
                <span className="metric-label">Highest Risk Lat/Lon</span>
                <span className="metric-value" style={{ fontSize: '1.25rem', padding: '0.45rem 0' }}>
                  {stats.highest_risk_zone ? `${stats.highest_risk_zone.lat.toFixed(4)}, ${stats.highest_risk_zone.lon.toFixed(4)}` : 'N/A'}
                </span>
                <span className="metric-subtext">
                  {stats.highest_risk_zone ? `Risk Score: ${stats.highest_risk_zone.score.toFixed(1)} (${stats.highest_risk_zone.police_station})` : 'No hotspots'}
                </span>
              </div>
            </section>
          )}

        {/* ─── TAB 1: ZONE INTELLIGENCE ────────────────────────────────────── */}
        {activeTab === "Zone Intelligence" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="dashboard-grid-main">
              {/* Column 1: Map and Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card card-animate delay-2" style={{ padding: '1rem' }}>
                  <div className="card-header" style={{ marginBottom: '0.75rem' }}>
                    <h3 className="card-title"><MapIcon size={16} style={{ color: 'var(--system-blue)' }} /> Geographic Violation Heatmap</h3>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--system-red)' }}></span> Hotspots (Gap)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--system-orange)' }}></span> Hotspots (Normal)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(10, 132, 255, 0.4)' }}></span> Cases
                      </span>
                    </div>
                  </div>
                  
                  <div className="map-container">
                    <MapContainer center={[12.96, 77.61]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      />
                      
                      {/* Render raw violations as small light circles */}
                      {violations.map((v, idx) => (
                        <CircleMarker 
                          key={`v-${idx}`}
                          center={[v.lat, v.lon]}
                          radius={2}
                          pathOptions={{ color: 'rgba(10, 132, 255, 0.15)', fillColor: 'var(--system-blue)', fillOpacity: 0.25, weight: 0 }}
                        />
                      ))}

                      {/* Render clustered hotspots as larger circles with popup details */}
                      {hotspots.map((h, idx) => {
                        const radius = Math.max(8, Math.min(h.congestion_score * 0.4, 25));
                        const isGap = h.enforcement_gap_flag;
                        const color = isGap ? 'var(--system-red)' : 'var(--system-orange)';
                        
                        return (
                          <CircleMarker
                            key={`h-${h.cluster_id}`}
                            center={[h.lat, h.lon]}
                            radius={radius}
                            pathOptions={{
                              color: color,
                              fillColor: color,
                              fillOpacity: 0.5,
                              weight: 1.5,
                              dashArray: isGap ? '4' : null
                            }}
                          >
                            <Popup>
                              <div style={{ minWidth: '180px' }}>
                                <h4>Zone {h.cluster_id}</h4>
                                <p><strong>Primary Offence:</strong> {h.top_violation}</p>
                                <p><strong>Cases Count:</strong> {h.violation_count}</p>
                                <p><strong>Risk Score:</strong> {h.congestion_score.toFixed(1)}</p>
                                <p><strong>Approval Rate:</strong> {(h.approval_rate * 100).toFixed(0)}%</p>
                                <p><strong>Jurisdiction:</strong> {h.top_police_station} Station</p>
                                {isGap && <p style={{ color: 'var(--system-red)', fontWeight: 'bold', marginTop: '4px' }}>⚠️ UNDER-ENFORCED ZONE</p>}
                              </div>
                            </Popup>
                          </CircleMarker>
                        );
                      })}
                    </MapContainer>
                  </div>
                </div>
              </div>

              {/* Column 2: Enforcement Gap list & details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card card-animate delay-2" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header">
                    <h3 className="card-title">
                      <ShieldAlert size={16} style={{ color: 'var(--system-red)' }} /> Gap Alert Watchlist
                    </h3>
                    <span className="badge badge-red">{stats.enforcement_gaps} Flagged</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    Zones with low case approval rates (&lt;60%). High traffic impact but low ticketing efficiency. Requires patrolling officer audit.
                  </p>

                  <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Zone</th>
                          <th>Cases</th>
                          <th>Approval</th>
                          <th>Station</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hotspots.filter(h => h.enforcement_gap_flag).map(h => (
                          <tr key={h.cluster_id}>
                            <td><span style={{ color: 'var(--system-blue)', fontWeight: 600 }}>#{h.cluster_id}</span></td>
                            <td>{h.violation_count}</td>
                            <td>
                              <span style={{ color: 'var(--system-red)', fontWeight: 600 }}>
                                {(h.approval_rate * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td>{h.top_police_station}</td>
                          </tr>
                        ))}
                        {hotspots.filter(h => h.enforcement_gap_flag).length === 0 && (
                          <tr>
                            <td colSpan="4" style={{ textCombineUpwrite: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No enforcement gaps currently flagged!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Standardized animated BTP processing flowchart */}
            <PipelineFlowchart />
          </div>
        )}

        {/* ─── TAB 2: RISK SCORING ────────────────────────────────────────── */}
        {activeTab === "Risk Scoring" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="dashboard-grid-main">
              {/* Chart 1: Bar chart of congestion score */}
              <div className="card card-animate delay-2">
                <div className="card-header">
                  <h3 className="card-title"><BarChart2 size={16} style={{ color: 'var(--system-blue)' }} /> Top 15 Congestion Hotspots (Risk Score)</h3>
                </div>
                <div className="chart-container-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hotspots.slice(0, 15)}>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="cluster_id" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} tickFormatter={(val) => `Zone ${val}`} />
                      <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                        formatter={(value) => [`${value.toFixed(1)}`, 'Risk Score']}
                      />
                      <Bar dataKey="congestion_score" radius={[4, 4, 0, 0]}>
                        {hotspots.slice(0, 15).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.enforcement_gap_flag ? 'var(--system-red)' : 'var(--system-blue)'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Scatter plot of gap analysis */}
              <div className="card card-animate delay-2">
                <div className="card-header">
                  <h3 className="card-title"><Info size={16} style={{ color: 'var(--system-orange)' }} /> Case Count vs Approval</h3>
                </div>
                <div className="chart-container-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                      <XAxis type="number" dataKey="violation_count" name="Total Cases" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                      <YAxis type="number" dataKey="approval_rate" name="Approval Rate" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} unit="%" domain={[0, 1]} tickFormatter={(val) => `${(val*100).toFixed(0)}%`} />
                      <ZAxis type="number" dataKey="congestion_score" range={[60, 400]} name="Risk Score" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                        formatter={(value, name) => {
                          if (name === "Approval Rate") return [`${(value * 100).toFixed(0)}%`, name];
                          return [value, name];
                        }}
                      />
                      <Scatter name="Zones" data={hotspots} fill="var(--system-blue)">
                        {hotspots.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.enforcement_gap_flag ? 'var(--system-red)' : 'var(--system-green)'} 
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Complete hotspots data table */}
            <div className="card card-animate delay-3">
              <div className="card-header">
                <h3 className="card-title">Zone Prioritization & Scoring Ledger</h3>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Zone ID</th>
                      <th>Risk Score</th>
                      <th>Cases</th>
                      <th>Approval Rate</th>
                      <th>Enforcement Gap</th>
                      <th>Primary Violation</th>
                      <th>Peak Hour</th>
                      <th>Nearest Police Station</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotspots.map(h => (
                      <tr key={h.cluster_id}>
                        <td><span style={{ color: 'var(--system-blue)', fontWeight: 600 }}>Zone #{h.cluster_id}</span></td>
                        <td><span style={{ fontWeight: 700 }}>{h.congestion_score.toFixed(1)}</span></td>
                        <td>{h.violation_count}</td>
                        <td>{(h.approval_rate * 100).toFixed(0)}%</td>
                        <td>
                          {h.enforcement_gap_flag ? (
                            <span className="badge badge-red">GAP FLAG</span>
                          ) : (
                            <span className="badge badge-green">OPTIMAL</span>
                          )}
                        </td>
                        <td>{h.top_violation}</td>
                        <td>{h.peak_hour}:00</td>
                        <td>{h.top_police_station}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: SHIFT DEPLOYMENT ────────────────────────────────────── */}
        {activeTab === "Shift Deployment" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card card-animate delay-1">
              <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>
                <Clock size={16} style={{ color: 'var(--system-blue)' }} /> Shift Patrol Recommendations
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Operational shifting windows aligned to peak violation times and DBSCAN hotspots. Officers should prioritize red-tagged zones during their shift.
              </p>
            </div>

            <div className="shifts-grid">
              {Object.entries(shifts).map(([shiftName, data], idx) => (
                <div key={shiftName} className={`card shift-card card-animate delay-${Math.min(4, idx + 2)}`}>
                  <div className="shift-header">
                    <span className="shift-name">{shiftName} Shift</span>
                    <span className="shift-time">{data.hours}</span>
                  </div>
                  
                  <div className="shift-meta">
                    <div className="shift-meta-item" style={{ flex: '1.5' }}>
                      <span className="shift-meta-label">Primary Offence</span>
                      <span className="shift-meta-value" style={{ fontSize: '0.95rem' }}>{data.top_violation}</span>
                    </div>
                    <div className="shift-meta-item" style={{ flex: '1' }}>
                      <span className="shift-meta-label">Total Cases</span>
                      <span className="shift-meta-value" style={{ color: 'var(--system-blue)' }}>{data.total}</span>
                    </div>
                    <div className="shift-meta-item" style={{ flex: '1', textAlign: 'right' }}>
                      <span className="shift-meta-label">Alert Level</span>
                      <span className="shift-meta-value" style={{ color: data.has_gap_zone ? 'var(--system-red)' : 'var(--system-green)' }}>
                        {data.has_gap_zone ? "High" : "Normal"}
                      </span>
                    </div>
                  </div>

                  <div className="shift-hotspots-section">
                    <span className="shift-meta-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Top Active Hotspots</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data.top_hotspots.map(th => (
                        <div key={th.cluster_id} className="shift-hotspot-item">
                          <div className="shift-hotspot-info">
                            <span className="shift-hotspot-title">Zone #{th.cluster_id}</span>
                            <span className="shift-hotspot-station">{th.police_station} precinct</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="shift-hotspot-metric">{th.count} cases</span>
                            {th.is_gap && <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>GAP</span>}
                          </div>
                        </div>
                      ))}
                      {data.top_hotspots.length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No active hotspots during this window.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 4: STATION ANALYSIS ────────────────────────────────────── */}
        {activeTab === "Station Analysis" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Selection control */}
            <div className="card card-animate delay-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 className="card-title">Police Station Precinct Ledger</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Filter enforcement efficiency, resolution times, and vehicle distributions by traffic police jurisdiction.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Select Station:</span>
                <select 
                  className="select-control"
                  value={selectedStation} 
                  onChange={(e) => setSelectedStation(e.target.value)}
                >
                  {stations.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {stationData && (
              <>
                {/* Station Overview metrics in 2-column layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', width: '100%' }} className="station-overview-container">
                  {/* Left Column: Custom SVG Activity Rings */}
                  <div className="card card-animate delay-2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="card-header" style={{ marginBottom: '0.5rem' }}>
                      <h3 className="card-title"><Activity size={16} style={{ color: 'var(--system-teal)' }} /> Precinct Efficiency Rings</h3>
                    </div>
                    <PrecinctActivityRings 
                      approvalRate={stationData.approval_rate}
                      resolutionCompliance={Math.max(0.1, Math.min(0.95, 24 / Math.max(1, stationData.avg_resolution_hours || 24)))}
                      activityRate={Math.max(0.1, Math.min(0.99, 1 - (stationData.gaps_count / Math.max(1, stationData.hotspots_count || 1))))}
                    />
                  </div>

                  {/* Right Column: Key metrics cards */}
                  <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div className="card metric-card card-animate delay-2">
                      <span className="metric-label">Jurisdiction Cases</span>
                      <span className="metric-value" style={{ fontSize: '1.8rem' }}>{stationData.total_cases.toLocaleString()}</span>
                      <span className="metric-subtext">Total recorded in precinct</span>
                    </div>
                    <div className="card metric-card card-animate delay-2">
                      <span className="metric-label">Avg Approval Rate</span>
                      <span className="metric-value" style={{ fontSize: '1.8rem', color: stationData.approval_rate < 0.6 ? 'var(--system-red)' : 'var(--system-green)' }}>
                        {(stationData.approval_rate * 100).toFixed(1)}%
                      </span>
                      <span className="metric-subtext">Target: &gt;60%</span>
                    </div>
                    <div className="card metric-card card-animate delay-2">
                      <span className="metric-label">Avg Resolution Time</span>
                      <span className="metric-value" style={{ fontSize: '1.8rem' }}>
                        {stationData.avg_resolution_hours ? `${stationData.avg_resolution_hours.toFixed(1)} hrs` : 'N/A'}
                      </span>
                      <span className="metric-subtext">Target: &lt;24 hrs</span>
                    </div>
                    <div className="card metric-card card-animate delay-2">
                      <span className="metric-label">Active Gaps / Hotspots</span>
                      <span className="metric-value" style={{ fontSize: '1.8rem' }}>
                        {stationData.gaps_count} / {stationData.hotspots_count}
                      </span>
                      <span className="metric-subtext">Requires officer patrol dispatch</span>
                    </div>
                  </div>
                </div>

                {/* Breakdown grids */}
                <div className="station-grid">
                  {/* Left Column: Monthly trend and Vehicle mix */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Chart 1: Monthly cases */}
                    <div className="card card-animate delay-3">
                      <div className="card-header">
                        <h3 className="card-title">Enforcement Activity Trend (Jan-May 2024)</h3>
                      </div>
                      <div className="chart-container-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(stationData.monthly_trend).map(([m, c]) => {
                            const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May"];
                            return { month: monthNames[parseInt(m)], cases: c };
                          })}>
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="month" stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                            <YAxis stroke="var(--text-secondary)" style={{ fontSize: '0.75rem' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                            />
                            <Bar dataKey="cases" fill="var(--system-blue)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Chart 2: Vehicle distribution */}
                    <div className="card card-animate delay-3">
                      <div className="card-header">
                        <h3 className="card-title">Vehicle Mix Breakdown</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '240px' }}>
                        <div style={{ height: '200px', width: '60%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(stationData.vehicle_mix).map(([k, v]) => ({ name: k, value: v }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {Object.entries(stationData.vehicle_mix).map((entry, index) => {
                                  const colors = ['var(--system-blue)', 'var(--system-teal)', 'var(--system-green)', 'var(--system-orange)', 'var(--system-red)', 'var(--system-indigo)'];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ width: '40%', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {Object.entries(stationData.vehicle_mix).map(([k, v], index) => {
                            const colors = ['var(--system-blue)', 'var(--system-teal)', 'var(--system-green)', 'var(--system-orange)', 'var(--system-red)', 'var(--system-indigo)'];
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: colors[index % colors.length] }}></span>
                                <span style={{ color: 'var(--text-secondary)' }}>{k}: <strong style={{ color: 'var(--text-primary)' }}>{v}</strong></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Violation types list & Top junctions list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Card 1: Top Violations */}
                    <div className="card card-animate delay-4">
                      <div className="card-header">
                        <h3 className="card-title">Top Infraction Offences</h3>
                      </div>
                      <div className="station-list-container">
                        {stationData.top_violations.map((tv, idx) => (
                          <div key={idx} className="station-list-item">
                            <span className="station-list-item-label">
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getViolationColor(tv.violation) }}></span>
                              {tv.violation}
                            </span>
                            <span className="station-list-item-value">{tv.count} cases</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card 2: Top Junctions */}
                    <div className="card card-animate delay-4">
                      <div className="card-header">
                        <h3 className="card-title">Key Congested Junctions</h3>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>
                        Junction locations with the highest volume of parking violations in {selectedStation} police jurisdiction.
                      </p>
                      <div className="station-list-container">
                        {stationData.top_junctions.map((tj, idx) => (
                          <div key={idx} style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tj.junction}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Location spot {idx+1}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tj.count}</span>
                              <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === "MapmyIndia View" && (
          <div className="card" style={{ height: '600px', padding: '0.5rem' }}>
            <iframe 
              src={`${API_BASE}/mapmyindia/html`} 
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', backgroundColor: '#07090e' }}
              title="MapmyIndia Dashboard View"
            />
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
