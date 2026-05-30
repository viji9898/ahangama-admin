import {
  Input,
  Space,
  Typography,
} from "antd";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  counts: {
    total: number;
    live: number;
    comingSoon: number;
    results: number;
  };
};

export function VenueSearchAndFilters({
  search,
  onSearchChange,
  counts,
}: Props) {
  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Input.Search
        allowClear
        size="large"
        placeholder="Search venues, areas, tags, or slugs"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <div style={{ overflowX: "auto" }}>
        <Space size={[10, 10]} wrap style={{ minWidth: 430 }}>
          {[
            { label: "Results", value: counts.results },
            { label: "Total", value: counts.total },
            { label: "Live", value: counts.live },
            { label: "Coming Soon", value: counts.comingSoon },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(15, 23, 42, 0.08)",
                background: "rgba(255, 255, 255, 0.82)",
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {item.label}
              </Typography.Text>
              <Typography.Text
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {item.value}
              </Typography.Text>
            </div>
          ))}
        </Space>
      </div>
    </Space>
  );
}
