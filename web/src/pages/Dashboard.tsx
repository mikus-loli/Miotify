import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/api/client';
import type { StatsResponse } from '@/types';
import Icon from '@/components/Icon';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#818cf8', '#a78bfa', '#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#c084fc', '#34d399'];

const PIE_COLORS = ['#4ade80', '#fbbf24', '#f87171'];

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={24} color="#ffffff" />
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: 'var(--color-text)' }}>{title}</h3>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        boxShadow: '0 4px 16px var(--color-shadow)',
        fontSize: 13,
      }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color, fontWeight: 600 }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.getStats(token).then((data) => {
      setStats(data);
    }).catch((err) => {
      console.error('Failed to fetch stats:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <span className="loading-spinner loading-spinner-lg" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="empty-state">
        <p>📊</p>
        <p>无法加载统计数据</p>
      </div>
    );
  }

  const priorityData = [
    { name: '低优先级', value: stats.priorityStats.low },
    { name: '一般优先级', value: stats.priorityStats.normal },
    { name: '紧急', value: stats.priorityStats.high },
  ].filter(d => d.value > 0);

  const dayLabels = stats.messagesByDay.map(d => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>仪表盘</h1>
          <p className="page-header-subtitle">系统概览与数据统计</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          icon="message"
          label="总消息数"
          value={stats.totalMessages}
          color="var(--gradient-brand)"
          sub={`今日 +${stats.todayMessages}`}
        />
        <StatCard
          icon="app"
          label="应用数"
          value={stats.totalApps}
          color="linear-gradient(135deg, #60a5fa, #3b82f6)"
        />
        <StatCard
          icon="users"
          label="用户数"
          value={stats.totalUsers}
          color="linear-gradient(135deg, #4ade80, #22c55e)"
        />
        <StatCard
          icon="plugin"
          label="今日消息"
          value={stats.todayMessages}
          color="linear-gradient(135deg, #fbbf24, #f59e0b)"
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
        marginBottom: 20,
      }}>
        <ChartCard title="近7日消息趋势">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.messagesByDay.map((d, i) => ({ ...d, date: dayLabels[i] }))}>
              <defs>
                <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" name="消息数" stroke="#818cf8" strokeWidth={2} fill="url(#colorMessages)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="24小时消息分布">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.messagesByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                interval={2}
                tickFormatter={(h: number) => `${h}:00`}
              />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="消息数" radius={[4, 4, 0, 0]}>
                {stats.messagesByHour.map((_, index) => (
                  <Cell key={index} fill="#818cf8" fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 20,
      }}>
        <ChartCard title="应用消息分布">
          {stats.messagesByApp.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.messagesByApp} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="消息数" radius={[0, 4, 4, 0]}>
                  {stats.messagesByApp.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 14 }}>
              暂无应用数据
            </div>
          )}
        </ChartCard>

        <ChartCard title="消息优先级分布">
          {priorityData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {priorityData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {priorityData.map((item, index) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: PIE_COLORS[index],
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{item.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginLeft: 'auto' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 14 }}>
              暂无消息数据
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
