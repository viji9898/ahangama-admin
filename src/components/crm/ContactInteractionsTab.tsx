import { Button, Col, DatePicker, Form, Input, List, Row, Select, Space, Tag, Typography } from "antd";
import type { FormInstance } from "antd/es/form";
import type { Dayjs } from "dayjs";
import type {
  InteractionOutcome,
  InteractionType,
  PartnerContact,
  PartnerInteraction,
} from "../../types/crm";

type Props = {
  activeVenueId: string | null;
  selectedContact: PartnerContact | null;
  interactionScope: "venue" | "contact";
  interactionForm: FormInstance;
  interactionSubmitting: boolean;
  interactions: PartnerInteraction[];
  interactionOptions: { label: string; value: InteractionType }[];
  interactionOutcomeOptions: { label: string; value: InteractionOutcome }[];
  onInteractionScopeChange: (value: "venue" | "contact") => void;
  onSubmit: (values: {
    interactionType: InteractionType;
    outcomeStatus: InteractionOutcome;
    summary: string;
    feedback?: string;
    nextAction?: string;
    nextFollowUpAt?: Dayjs;
  }) => void;
};

export default function ContactInteractionsTab({
  activeVenueId,
  selectedContact,
  interactionScope,
  interactionForm,
  interactionSubmitting,
  interactions,
  interactionOptions,
  interactionOutcomeOptions,
  onInteractionScopeChange,
  onSubmit,
}: Props) {
  if (!activeVenueId) {
    return (
      <Typography.Text type="secondary">
        Select a venue/contact to log interactions.
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space align="center" wrap>
        <Typography.Text type="secondary">Interaction Scope</Typography.Text>
        <Select
          value={interactionScope}
          style={{ width: 220 }}
          options={[
            { label: "All contacts in this venue", value: "venue" },
            { label: "Only selected contact", value: "contact" },
          ]}
          onChange={(value) => onInteractionScopeChange(value as "venue" | "contact")}
        />
        {selectedContact ? (
          <Typography.Text type="secondary">
            Current contact: {selectedContact.contactName}
          </Typography.Text>
        ) : null}
      </Space>

      <Form
        form={interactionForm}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          interactionType: "call",
          outcomeStatus: "pending",
        }}
      >
        <Row gutter={12}>
          <Col xs={24} md={5}>
            <Form.Item
              name="interactionType"
              label="Type"
              rules={[{ required: true, message: "Type is required" }]}
            >
              <Select options={interactionOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={5}>
            <Form.Item
              name="outcomeStatus"
              label="Outcome"
              rules={[{ required: true, message: "Outcome is required" }]}
            >
              <Select options={interactionOutcomeOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item
              name="summary"
              label="Summary"
              rules={[{ required: true, message: "Summary is required" }]}
            >
              <Input placeholder="Called manager, waiting for stock confirmation" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="feedback" label="Feedback">
              <Input.TextArea
                rows={2}
                placeholder="Vendor feedback, blockers, or comments"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="nextFollowUpAt" label="Follow-up Date">
              <DatePicker
                showTime
                style={{ width: "100%" }}
                format="YYYY-MM-DD HH:mm"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="nextAction" label="Next Action">
              <Input placeholder="Follow up Friday" />
            </Form.Item>
          </Col>
        </Row>
        <Button htmlType="submit" type="primary" loading={interactionSubmitting}>
          Log Interaction
        </Button>
      </Form>

      <List
        dataSource={interactions}
        locale={{ emptyText: "No interactions logged yet" }}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space>
                  <Tag color="blue">{item.interactionType}</Tag>
                  <Tag>
                    {interactionOutcomeOptions.find(
                      (option) => option.value === item.outcomeStatus,
                    )?.label || item.outcomeStatus}
                  </Tag>
                  <Typography.Text>{item.summary}</Typography.Text>
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  <Typography.Text type="secondary">
                    {new Date(item.interactionAt).toLocaleString()}
                  </Typography.Text>
                  {item.nextAction ? (
                    <Typography.Text type="secondary">Next: {item.nextAction}</Typography.Text>
                  ) : null}
                  {item.nextFollowUpAt ? (
                    <Typography.Text type="secondary">
                      Follow-up: {new Date(item.nextFollowUpAt).toLocaleString()}
                    </Typography.Text>
                  ) : null}
                  {item.feedback ? (
                    <Typography.Text type="secondary">Feedback: {item.feedback}</Typography.Text>
                  ) : null}
                  {item.contactName ? (
                    <Typography.Text type="secondary">Contact: {item.contactName}</Typography.Text>
                  ) : null}
                  {item.createdBy ? (
                    <Typography.Text type="secondary">By: {item.createdBy}</Typography.Text>
                  ) : null}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Space>
  );
}