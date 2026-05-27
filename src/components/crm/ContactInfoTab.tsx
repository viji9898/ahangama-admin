import {
  Button,
  Col,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import type { PartnerContact, PartnerContactRole } from "../../types/crm";
import { makeGmailComposeUrl, makeWhatsAppUrl } from "./contactLinks";
import type { DraftContact } from "./types";

type Props = {
  selectedContact: PartnerContact | null;
  draft: DraftContact | null;
  roleOptions: { label: string; value: PartnerContactRole }[];
  savingContact: boolean;
  onDraftChange: (patch: Partial<DraftContact>) => void;
  onSave: () => void;
};

export default function ContactInfoTab({
  selectedContact,
  draft,
  roleOptions,
  savingContact,
  onDraftChange,
  onSave,
}: Props) {
  if (!selectedContact || !draft) {
    return (
      <Typography.Text type="secondary">
        Select a contact to edit details.
      </Typography.Text>
    );
  }

  const whatsappUrl = makeWhatsAppUrl(draft.whatsapp);
  const gmailUrl = makeGmailComposeUrl(draft.email);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {whatsappUrl || gmailUrl ? (
        <Space wrap>
          {whatsappUrl ? (
            <Button href={whatsappUrl} target="_blank" rel="noreferrer">
              WhatsApp Contact
            </Button>
          ) : null}
          {gmailUrl ? (
            <Button href={gmailUrl} target="_blank" rel="noreferrer">
              Email Contact
            </Button>
          ) : null}
        </Space>
      ) : null}
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Venue Identifier</Typography.Text>
          <Input value={selectedContact.venueId} disabled />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Contact ID</Typography.Text>
          <Input value={selectedContact.id} disabled />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Role</Typography.Text>
          <Select
            value={draft.role}
            options={roleOptions}
            style={{ width: "100%" }}
            onChange={(value) =>
              onDraftChange({ role: value as PartnerContactRole })
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Contact Name</Typography.Text>
          <Input
            value={draft.contactName}
            onChange={(event) =>
              onDraftChange({ contactName: event.target.value })
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Email</Typography.Text>
          <Input
            value={draft.email}
            onChange={(event) => onDraftChange({ email: event.target.value })}
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">WhatsApp</Typography.Text>
          <Input
            value={draft.whatsapp}
            onChange={(event) =>
              onDraftChange({ whatsapp: event.target.value })
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Phone</Typography.Text>
          <Input
            value={draft.phone}
            onChange={(event) => onDraftChange({ phone: event.target.value })}
          />
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Primary Contact</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Switch
              checked={draft.isPrimary}
              onChange={(checked) => onDraftChange({ isPrimary: checked })}
            />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Active</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Switch
              checked={draft.active}
              onChange={(checked) => onDraftChange({ active: checked })}
            />
          </div>
        </Col>
        <Col xs={24}>
          <Typography.Text type="secondary">Notes</Typography.Text>
          <Input.TextArea
            value={draft.notes}
            rows={3}
            onChange={(event) => onDraftChange({ notes: event.target.value })}
          />
        </Col>
      </Row>
      <Button type="primary" onClick={onSave} loading={savingContact}>
        Save Contact
      </Button>
    </Space>
  );
}
