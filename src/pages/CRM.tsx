import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import type { Venue } from "../types/venue";
import type {
  InteractionOutcome,
  InteractionType,
  PartnerContact,
  PartnerContactRole,
  PartnerInteraction,
  PartnerTouchpointInventory,
  TouchpointType,
} from "../types/crm";

const CONTACTS_LIST_ENDPOINT = "/.netlify/functions/api-partner-contacts-list";
const CONTACTS_CREATE_ENDPOINT =
  "/.netlify/functions/api-partner-contacts-create";
const CONTACTS_UPDATE_ENDPOINT =
  "/.netlify/functions/api-partner-contacts-update";
const TOUCHPOINTS_LIST_ENDPOINT =
  "/.netlify/functions/api-partner-touchpoints-list";
const TOUCHPOINTS_UPSERT_ENDPOINT =
  "/.netlify/functions/api-partner-touchpoints-upsert";
const INTERACTIONS_LIST_ENDPOINT =
  "/.netlify/functions/api-partner-interactions-list";
const INTERACTIONS_CREATE_ENDPOINT =
  "/.netlify/functions/api-partner-interactions-create";
const CRM_EXPORT_ENDPOINT = "/.netlify/functions/api-partner-crm-export";
const CRM_IMPORT_ENDPOINT = "/.netlify/functions/api-partner-crm-import";
const VENUES_LIST_ENDPOINT = "/.netlify/functions/api-venues-list";

const ROLE_OPTIONS: { label: string; value: PartnerContactRole }[] = [
  { label: "Owner", value: "owner" },
  { label: "Manager", value: "manager" },
  { label: "Other", value: "other" },
];

const TOUCHPOINT_OPTIONS: { label: string; value: TouchpointType }[] = [
  { label: "QR Stand", value: "qr_stand" },
  { label: "Postcard Stand", value: "postcard_stand" },
  { label: "Tea Tin", value: "tea_tin" },
  { label: "Tote Bag", value: "tote_bag" },
  { label: "Other", value: "other" },
];

const INTERACTION_OPTIONS: { label: string; value: InteractionType }[] = [
  { label: "Call", value: "call" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Email", value: "email" },
  { label: "Visit", value: "visit" },
  { label: "Feedback", value: "feedback" },
];

const INTERACTION_OUTCOME_OPTIONS: {
  label: string;
  value: InteractionOutcome;
}[] = [
  { label: "Pending", value: "pending" },
  { label: "Successful", value: "successful" },
  { label: "No Response", value: "no_response" },
  { label: "Not Interested", value: "not_interested" },
];

type DraftContact = {
  contactName: string;
  role: PartnerContactRole;
  referenceKey: string;
  email?: string;
  whatsapp?: string;
  phone?: string;
  notes?: string;
  isPrimary: boolean;
  active: boolean;
};

function normalizeReferenceKey(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const raw = await response.text();

  if (!contentType.includes("application/json")) {
    const snippet = raw.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `Expected JSON from ${url}, but got ${contentType || "unknown content type"}. ` +
        `This usually means the function route is unavailable and returned HTML. ` +
        `Response starts with: ${snippet}`,
    );
  }

  let payload;
  try {
    payload = JSON.parse(raw) as { ok?: boolean; error?: string } & T;
  } catch {
    throw new Error(`Invalid JSON response from ${url}`);
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Request failed");
  }

  return payload;
}

function toDraft(contact: PartnerContact): DraftContact {
  return {
    contactName: contact.contactName,
    role: contact.role,
    referenceKey: contact.referenceKey,
    email: contact.email || "",
    whatsapp: contact.whatsapp || "",
    phone: contact.phone || "",
    notes: contact.notes || "",
    isPrimary: Boolean(contact.isPrimary),
    active: Boolean(contact.active),
  };
}

export default function CRM() {
  const [loading, setLoading] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [draft, setDraft] = useState<DraftContact | null>(null);
  const [touchpoints, setTouchpoints] = useState<PartnerTouchpointInventory[]>(
    [],
  );
  const [interactions, setInteractions] = useState<PartnerInteraction[]>([]);
  const [touchpointDraft, setTouchpointDraft] = useState<
    Partial<Record<TouchpointType, number>>
  >({});
  const [touchpointSavingType, setTouchpointSavingType] =
    useState<TouchpointType | null>(null);
  const [interactionScope, setInteractionScope] = useState<"venue" | "contact">(
    "venue",
  );
  const [interactionSubmitting, setInteractionSubmitting] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [createForm] = Form.useForm();
  const [interactionForm] = Form.useForm();
  const [csvImportForm] = Form.useForm();

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === selectedContactId) || null,
    [contacts, selectedContactId],
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (selectedVenueId !== "all" && contact.venueId !== selectedVenueId) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        contact.referenceKey,
        contact.contactName,
        contact.role,
        contact.email,
        contact.whatsapp,
        contact.phone,
        contact.venueName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [contacts, search, selectedVenueId]);

  const activeVenueId = useMemo(() => {
    if (selectedVenueId !== "all") return selectedVenueId;
    return selectedContact?.venueId || null;
  }, [selectedVenueId, selectedContact]);

  const venueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    contacts.forEach((contact) => {
      counts.set(contact.venueId, (counts.get(contact.venueId) || 0) + 1);
    });
    return counts;
  }, [contacts]);

  const touchpointByType = useMemo(() => {
    const map = new Map<TouchpointType, PartnerTouchpointInventory>();
    touchpoints.forEach((item) => {
      map.set(item.touchpointType, item);
    });
    return map;
  }, [touchpoints]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [venuesPayload, contactsPayload] = await Promise.all([
          fetchJson<{ venues: Venue[] }>(VENUES_LIST_ENDPOINT),
          fetchJson<{ contacts: PartnerContact[] }>(CONTACTS_LIST_ENDPOINT),
        ]);

        if (cancelled) return;

        const loadedContacts = contactsPayload.contacts || [];
        setVenues(venuesPayload.venues || []);
        setContacts(loadedContacts);

        const first = loadedContacts[0];
        if (first) {
          setSelectedContactId(first.id);
          setSelectedVenueId(first.venueId);
          setDraft(toDraft(first));
          createForm.setFieldValue("venueId", first.venueId);
        }
      } catch (error) {
        if (!cancelled) {
          message.error(String((error as Error)?.message || error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [createForm]);

  useEffect(() => {
    if (selectedVenueId === "all") return;
    createForm.setFieldValue("venueId", selectedVenueId);
  }, [createForm, selectedVenueId]);

  useEffect(() => {
    if (selectedVenueId === "all") return;

    if (selectedContact && selectedContact.venueId === selectedVenueId) {
      return;
    }

    const firstForVenue = contacts.find(
      (item) => item.venueId === selectedVenueId,
    );
    setSelectedContactId(firstForVenue?.id || "");
  }, [contacts, selectedContact, selectedVenueId]);

  useEffect(() => {
    if (!activeVenueId) {
      setTouchpoints([]);
      setInteractions([]);
      setTouchpointDraft({});
      return;
    }
    const currentVenueId = activeVenueId;

    if (selectedContact) {
      setDraft(toDraft(selectedContact));
    }

    let cancelled = false;
    async function loadRelated() {
      try {
        const venueId = encodeURIComponent(currentVenueId);
        const contactId = selectedContactId
          ? encodeURIComponent(selectedContactId)
          : "";
        const interactionUrl =
          interactionScope === "contact" && contactId
            ? `${INTERACTIONS_LIST_ENDPOINT}?venueId=${venueId}&contactId=${contactId}`
            : `${INTERACTIONS_LIST_ENDPOINT}?venueId=${venueId}`;

        const [touchpointPayload, interactionPayload] = await Promise.all([
          fetchJson<{ touchpoints: PartnerTouchpointInventory[] }>(
            `${TOUCHPOINTS_LIST_ENDPOINT}?venueId=${venueId}`,
          ),
          fetchJson<{ interactions: PartnerInteraction[] }>(interactionUrl),
        ]);

        if (cancelled) return;

        setTouchpoints(touchpointPayload.touchpoints || []);
        setInteractions(interactionPayload.interactions || []);
        const initialDraft = {} as Partial<Record<TouchpointType, number>>;
        (touchpointPayload.touchpoints || []).forEach((item) => {
          initialDraft[item.touchpointType] = item.quantity;
        });
        setTouchpointDraft(initialDraft);
      } catch (error) {
        if (!cancelled) {
          message.error(String((error as Error)?.message || error));
        }
      }
    }

    loadRelated();

    return () => {
      cancelled = true;
    };
  }, [activeVenueId, interactionScope, selectedContact, selectedContactId]);

  async function handleCreateContact(values: {
    venueId: string;
    referenceKey: string;
    contactName: string;
    role: PartnerContactRole;
    email?: string;
    whatsapp?: string;
    phone?: string;
  }) {
    try {
      const payload = {
        ...values,
        referenceKey: normalizeReferenceKey(values.referenceKey),
      };

      const result = await fetchJson<{ contact: PartnerContact }>(
        CONTACTS_CREATE_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setContacts((prev) => [result.contact, ...prev]);
      setSelectedVenueId(result.contact.venueId);
      setSelectedContactId(result.contact.id);
      createForm.resetFields();
      createForm.setFieldValue("venueId", result.contact.venueId);
      message.success("Partner contact created");
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    }
  }

  async function handleSaveContact() {
    if (!selectedContact || !draft) return;

    const payload = {
      id: selectedContact.id,
      contactName: draft.contactName.trim(),
      role: draft.role,
      referenceKey: normalizeReferenceKey(draft.referenceKey),
      email: draft.email || null,
      whatsapp: draft.whatsapp || null,
      phone: draft.phone || null,
      notes: draft.notes || null,
      isPrimary: draft.isPrimary,
      active: draft.active,
    };

    try {
      setSavingContact(true);
      const result = await fetchJson<{ contact: PartnerContact }>(
        CONTACTS_UPDATE_ENDPOINT,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      setContacts((prev) =>
        prev.map((item) => (item.id === result.contact.id ? result.contact : item)),
      );
      setDraft(toDraft(result.contact));
      message.success("Contact updated");
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setSavingContact(false);
    }
  }

  async function saveTouchpoint(touchpointType: TouchpointType, quantity: number) {
    if (!activeVenueId) return;

    try {
      setTouchpointSavingType(touchpointType);
      const result = await fetchJson<{ touchpoint: PartnerTouchpointInventory }>(
        TOUCHPOINTS_UPSERT_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify({
            venueId: activeVenueId,
            touchpointType,
            quantity,
            notes: touchpointByType.get(touchpointType)?.notes || null,
          }),
        },
      );

      setTouchpoints((prev) => {
        const next = prev.filter((item) => item.touchpointType !== touchpointType);
        next.push(result.touchpoint);
        return next.sort((a, b) => a.touchpointType.localeCompare(b.touchpointType));
      });
      message.success("Touchpoint updated");
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setTouchpointSavingType(null);
    }
  }

  async function handleAddInteraction(values: {
    interactionType: InteractionType;
    outcomeStatus: InteractionOutcome;
    summary: string;
    feedback?: string;
    nextAction?: string;
    nextFollowUpAt?: Dayjs;
  }) {
    if (!activeVenueId) return;

    try {
      setInteractionSubmitting(true);
      const result = await fetchJson<{ interaction: PartnerInteraction }>(
        INTERACTIONS_CREATE_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify({
            venueId: activeVenueId,
            contactId: selectedContact?.id || null,
            interactionType: values.interactionType,
            outcomeStatus: values.outcomeStatus,
            summary: values.summary,
            feedback: values.feedback || null,
            nextAction: values.nextAction || null,
            nextFollowUpAt: values.nextFollowUpAt
              ? values.nextFollowUpAt.toISOString()
              : null,
          }),
        },
      );

      setInteractions((prev) => [result.interaction, ...prev]);
      interactionForm.resetFields();
      message.success("Interaction logged");
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setInteractionSubmitting(false);
    }
  }

  async function handleCsvExport(resource: "contacts" | "touchpoints" | "interactions") {
    const params = new URLSearchParams({ resource });
    if (activeVenueId) {
      params.set("venueId", activeVenueId);
    }
    window.open(`${CRM_EXPORT_ENDPOINT}?${params.toString()}`, "_blank");
  }

  async function handleCsvImport(values: {
    resource: "contacts" | "touchpoints" | "interactions";
    csv: string;
  }) {
    try {
      setCsvImporting(true);
      const result = await fetchJson<{
        importedCount: number;
        errorCount: number;
        errors?: Array<{ row: number; error: string }>;
      }>(CRM_IMPORT_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(values),
      });

      if (result.errorCount > 0) {
        message.warning(
          `Imported ${result.importedCount} rows with ${result.errorCount} row errors`,
        );
      } else {
        message.success(`Imported ${result.importedCount} rows`);
      }

      csvImportForm.resetFields();

      const [contactsPayload] = await Promise.all([
        fetchJson<{ contacts: PartnerContact[] }>(CONTACTS_LIST_ENDPOINT),
      ]);
      setContacts(contactsPayload.contacts || []);
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setCsvImporting(false);
    }
  }

  const totalVisibleContacts = filteredContacts.length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Partner CRM
      </Typography.Title>

      <Alert
        type="info"
        showIcon
        message="Manage partner contacts, touchpoint inventory, and interaction logs."
      />

      <Card title="Venue Filters">
        <Space size={[8, 8]} wrap>
          <Tag.CheckableTag
            checked={selectedVenueId === "all"}
            onChange={() => setSelectedVenueId("all")}
          >
            All Venues ({contacts.length})
          </Tag.CheckableTag>
          {venues.map((venue) => {
            const venueId = String(venue.id || "").toLowerCase();
            if (!venueId || !venueCounts.get(venueId)) return null;
            return (
              <Tag.CheckableTag
                key={venueId}
                checked={selectedVenueId === venueId}
                onChange={() => setSelectedVenueId(venueId)}
              >
                {venue.name || venueId} ({venueCounts.get(venueId)})
              </Tag.CheckableTag>
            );
          })}
        </Space>
      </Card>

      <Card title="Create Partner Contact" loading={loading}>
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateContact}
          initialValues={{ role: "owner" }}
        >
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item
                name="venueId"
                label="Venue"
                rules={[{ required: true, message: "Select a venue" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={(venues || []).map((venue) => ({
                    label: `${venue.name || venue.id} (${venue.id})`,
                    value: String(venue.id || "").toLowerCase(),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item
                name="referenceKey"
                label="Reference Key"
                rules={[
                  { required: true, message: "Reference key is required" },
                  {
                    pattern: /^[A-Za-z0-9]+$/,
                    message: "Uppercase letters and numbers only",
                  },
                ]}
              >
                <Input placeholder="KAFFI01" />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item
                name="contactName"
                label="Contact Name"
                rules={[{ required: true, message: "Contact name is required" }]}
              >
                <Input placeholder="Owner or manager" />
              </Form.Item>
            </Col>
            <Col xs={24} md={3}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: "Role is required" }]}
              >
                <Select options={ROLE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} md={3}>
              <Form.Item name="email" label="Email">
                <Input placeholder="owner@venue.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={3}>
              <Form.Item name="whatsapp" label="WhatsApp">
                <Input placeholder="+94..." />
              </Form.Item>
            </Col>
          </Row>
          <Button htmlType="submit" type="primary">
            Create Contact
          </Button>
        </Form>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card
            title={`Contacts (${totalVisibleContacts})`}
            extra={
              <Input.Search
                allowClear
                placeholder="Search by ref key, name, venue"
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 220 }}
              />
            }
            loading={loading}
          >
            <List
              dataSource={filteredContacts}
              locale={{ emptyText: "No contacts yet" }}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: "pointer",
                    background:
                      selectedContactId === item.id ? "#f0f5ff" : "transparent",
                    borderRadius: 8,
                    paddingInline: 8,
                  }}
                  onClick={() => setSelectedContactId(item.id)}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Typography.Text strong>{item.referenceKey}</Typography.Text>
                        <Tag>{item.role}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Typography.Text>{item.contactName}</Typography.Text>
                        <Typography.Text type="secondary">
                          {item.venueName || item.venueId}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card
              title={selectedContact ? `Contact: ${selectedContact.referenceKey}` : "Contact"}
              loading={loading}
              extra={
                <Button
                  type="primary"
                  onClick={handleSaveContact}
                  loading={savingContact}
                  disabled={!selectedContact || !draft}
                >
                  Save Contact
                </Button>
              }
            >
              {!selectedContact || !draft ? (
                <Typography.Text type="secondary">
                  Select a contact to edit details.
                </Typography.Text>
              ) : (
                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Reference Key</Typography.Text>
                    <Input
                      value={draft.referenceKey}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                referenceKey: normalizeReferenceKey(event.target.value),
                              }
                            : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Contact Name</Typography.Text>
                    <Input
                      value={draft.contactName}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, contactName: event.target.value } : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Role</Typography.Text>
                    <Select
                      value={draft.role}
                      options={ROLE_OPTIONS}
                      style={{ width: "100%" }}
                      onChange={(value) =>
                        setDraft((prev) =>
                          prev ? { ...prev, role: value as PartnerContactRole } : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Email</Typography.Text>
                    <Input
                      value={draft.email}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, email: event.target.value } : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">WhatsApp</Typography.Text>
                    <Input
                      value={draft.whatsapp}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, whatsapp: event.target.value } : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Phone</Typography.Text>
                    <Input
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, phone: event.target.value } : prev,
                        )
                      }
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Primary Contact</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Switch
                        checked={draft.isPrimary}
                        onChange={(checked) =>
                          setDraft((prev) =>
                            prev ? { ...prev, isPrimary: checked } : prev,
                          )
                        }
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <Typography.Text type="secondary">Active</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Switch
                        checked={draft.active}
                        onChange={(checked) =>
                          setDraft((prev) =>
                            prev ? { ...prev, active: checked } : prev,
                          )
                        }
                      />
                    </div>
                  </Col>
                  <Col xs={24}>
                    <Typography.Text type="secondary">Notes</Typography.Text>
                    <Input.TextArea
                      value={draft.notes}
                      rows={3}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, notes: event.target.value } : prev,
                        )
                      }
                    />
                  </Col>
                </Row>
              )}
            </Card>

            <Card title="Touchpoint Inventory" loading={loading}>
              {!activeVenueId ? (
                <Typography.Text type="secondary">
                  Select a venue/contact to manage touchpoint counts.
                </Typography.Text>
              ) : (
                <List
                  dataSource={TOUCHPOINT_OPTIONS}
                  renderItem={(item) => {
                    const existing = touchpointByType.get(item.value);
                    return (
                      <List.Item
                        actions={[
                          <Button
                            key="save"
                            type="link"
                            loading={touchpointSavingType === item.value}
                            onClick={() => {
                              const parsed = Number(touchpointDraft[item.value] || 0);
                              if (!Number.isInteger(parsed) || parsed < 0) {
                                message.error("Quantity must be a whole number >= 0");
                                return;
                              }
                              void saveTouchpoint(item.value, parsed);
                            }}
                          >
                            Save
                          </Button>,
                        ]}
                      >
                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                          <Typography.Text>{item.label}</Typography.Text>
                          <InputNumber
                            min={0}
                            precision={0}
                            value={touchpointDraft[item.value] ?? existing?.quantity ?? 0}
                            onChange={(value) =>
                              setTouchpointDraft((prev) => ({
                                ...prev,
                                [item.value]: Number(value || 0),
                              }))
                            }
                          />
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              )}
            </Card>

            <Card title="Interaction Log" loading={loading}>
              {!activeVenueId ? (
                <Typography.Text type="secondary">
                  Select a venue/contact to log interactions.
                </Typography.Text>
              ) : (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Space align="center">
                    <Typography.Text type="secondary">Interaction Scope</Typography.Text>
                    <Select
                      value={interactionScope}
                      style={{ width: 220 }}
                      options={[
                        { label: "All contacts in this venue", value: "venue" },
                        { label: "Only selected contact", value: "contact" },
                      ]}
                      onChange={(value) =>
                        setInteractionScope(value as "venue" | "contact")
                      }
                    />
                  </Space>

                  <Form
                    form={interactionForm}
                    layout="vertical"
                    onFinish={handleAddInteraction}
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
                          <Select options={INTERACTION_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item
                          name="outcomeStatus"
                          label="Outcome"
                          rules={[{ required: true, message: "Outcome is required" }]}
                        >
                          <Select options={INTERACTION_OUTCOME_OPTIONS} />
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
                                {INTERACTION_OUTCOME_OPTIONS.find(
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
                                <Typography.Text type="secondary">
                                  Next: {item.nextAction}
                                </Typography.Text>
                              ) : null}
                              {item.nextFollowUpAt ? (
                                <Typography.Text type="secondary">
                                  Follow-up: {new Date(item.nextFollowUpAt).toLocaleString()}
                                </Typography.Text>
                              ) : null}
                              {item.feedback ? (
                                <Typography.Text type="secondary">
                                  Feedback: {item.feedback}
                                </Typography.Text>
                              ) : null}
                              {item.contactName ? (
                                <Typography.Text type="secondary">
                                  Contact: {item.contactName}
                                </Typography.Text>
                              ) : null}
                              {item.createdBy ? (
                                <Typography.Text type="secondary">
                                  By: {item.createdBy}
                                </Typography.Text>
                              ) : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Space>
              )}
            </Card>

            <Card title="CSV Tools" loading={loading}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space wrap>
                  <Button onClick={() => void handleCsvExport("contacts")}>Export Contacts CSV</Button>
                  <Button onClick={() => void handleCsvExport("touchpoints")}>Export Touchpoints CSV</Button>
                  <Button onClick={() => void handleCsvExport("interactions")}>Export Interactions CSV</Button>
                </Space>

                <Form
                  form={csvImportForm}
                  layout="vertical"
                  onFinish={handleCsvImport}
                  initialValues={{ resource: "contacts" }}
                >
                  <Row gutter={12}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        name="resource"
                        label="Import Resource"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { label: "Contacts", value: "contacts" },
                            { label: "Touchpoints", value: "touchpoints" },
                            { label: "Interactions", value: "interactions" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={18}>
                      <Form.Item
                        name="csv"
                        label="CSV Content"
                        rules={[{ required: true, message: "Paste CSV content" }]}
                      >
                        <Input.TextArea rows={5} placeholder="Paste CSV with header row" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button type="primary" htmlType="submit" loading={csvImporting}>
                    Import CSV
                  </Button>
                </Form>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
