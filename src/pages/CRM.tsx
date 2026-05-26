import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tabs,
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
import ContactInfoTab from "../components/crm/ContactInfoTab";
import ContactInteractionsTab from "../components/crm/ContactInteractionsTab";
import ContactInventoryTab from "../components/crm/ContactInventoryTab";
import ContactSummaryCards from "../components/crm/ContactSummaryCards";
import { makeGmailComposeUrl, makeWhatsAppUrl } from "../components/crm/contactLinks";
import type { ContactModalTab, DraftContact } from "../components/crm/types";

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
    email: contact.email || "",
    whatsapp: contact.whatsapp || "",
    phone: contact.phone || "",
    notes: contact.notes || "",
    isPrimary: Boolean(contact.isPrimary),
    active: Boolean(contact.active),
  };
}

function makeTouchpointDraft(items: PartnerTouchpointInventory[]) {
  const initialDraft = {} as Partial<Record<TouchpointType, number>>;
  items.forEach((item) => {
    initialDraft[item.touchpointType] = item.quantity;
  });
  return initialDraft;
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
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalTab, setContactModalTab] = useState<ContactModalTab>("info");
  const [createForm] = Form.useForm();
  const [interactionForm] = Form.useForm();

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
        contact.id,
        contact.venueId,
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
        setTouchpointDraft(makeTouchpointDraft(touchpointPayload.touchpoints || []));
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
    contactName: string;
    role: PartnerContactRole;
    email?: string;
    whatsapp?: string;
    phone?: string;
  }) {
    try {
      const result = await fetchJson<{ contact: PartnerContact }>(
        CONTACTS_CREATE_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify(values),
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

  const totalVisibleContacts = filteredContacts.length;
  const contactWhatsappUrl = makeWhatsAppUrl(selectedContact?.whatsapp);
  const contactGmailUrl = makeGmailComposeUrl(selectedContact?.email);
  const hasDraftChanges = Boolean(
    selectedContact && draft && JSON.stringify(draft) !== JSON.stringify(toDraft(selectedContact)),
  );
  const hasTouchpointChanges = TOUCHPOINT_OPTIONS.some((option) => {
    const savedQuantity = touchpointByType.get(option.value)?.quantity ?? 0;
    const draftQuantity = touchpointDraft[option.value] ?? savedQuantity;
    return Number(draftQuantity) !== Number(savedQuantity);
  });
  const hasInteractionFormChanges = interactionForm.isFieldsTouched();
  const hasModalChanges = hasDraftChanges || hasTouchpointChanges || hasInteractionFormChanges;

  const resetModalState = () => {
    if (selectedContact) {
      setDraft(toDraft(selectedContact));
    }
    setTouchpointDraft(makeTouchpointDraft(touchpoints));
    interactionForm.resetFields();
    setContactModalOpen(false);
  };

  const openContactModal = (tab: ContactModalTab) => {
    if (!selectedContact) {
      message.info("Select a contact first");
      return;
    }

    if (!activeVenueId) {
      message.info("Select a venue/contact first");
      return;
    }

    setContactModalTab(tab);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    if (!hasModalChanges) {
      resetModalState();
      return;
    }

    Modal.confirm({
      title: "Discard unsaved CRM changes?",
      content:
        "You have unsaved contact, interaction, or inventory changes in this modal.",
      okText: "Discard changes",
      cancelText: "Keep editing",
      onOk: resetModalState,
    });
  };

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
              <Form.Item label="Venue Identifier">
                <Input value={createForm.getFieldValue("venueId") || ""} disabled />
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
                placeholder="Search by contact id, venue id, name"
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
                        <Typography.Text strong>{item.contactName}</Typography.Text>
                        <Tag>{item.role}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Typography.Text type="secondary">Contact ID: {item.id}</Typography.Text>
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
            <Card title="Selected Contact" loading={loading}>
              {!selectedContact || !draft ? (
                <Typography.Text type="secondary">
                  Select a contact to view management cards.
                </Typography.Text>
              ) : (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {contactWhatsappUrl || contactGmailUrl ? (
                    <Space wrap>
                      {contactWhatsappUrl ? (
                        <Button href={contactWhatsappUrl} target="_blank" rel="noreferrer">
                          WhatsApp Contact
                        </Button>
                      ) : null}
                      {contactGmailUrl ? (
                        <Button href={contactGmailUrl} target="_blank" rel="noreferrer">
                          Email Contact
                        </Button>
                      ) : null}
                    </Space>
                  ) : null}

                  <ContactSummaryCards
                    selectedContact={selectedContact}
                    interactions={interactions}
                    interactionScope={interactionScope}
                    touchpoints={touchpoints}
                    touchpointOptions={TOUCHPOINT_OPTIONS}
                    onOpenTab={openContactModal}
                  />
                </Space>
              )}
            </Card>

            <Modal
              title={
                selectedContact
                  ? `Manage ${selectedContact.contactName} (${selectedContact.venueName || selectedContact.venueId})`
                  : "Manage Contact"
              }
              open={contactModalOpen}
              onCancel={handleCloseContactModal}
              width={980}
              footer={null}
              destroyOnHidden
            >
              <Tabs
                activeKey={contactModalTab}
                onChange={(key) => setContactModalTab(key as ContactModalTab)}
                items={[
                  {
                    key: "info",
                    label: "Info",
                    children: (
                      <ContactInfoTab
                        selectedContact={selectedContact}
                        draft={draft}
                        roleOptions={ROLE_OPTIONS}
                        savingContact={savingContact}
                        onDraftChange={(patch) =>
                          setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                        }
                        onSave={handleSaveContact}
                      />
                    ),
                  },
                  {
                    key: "interactions",
                    label: "Log Call/Interaction",
                    children: (
                      <ContactInteractionsTab
                        activeVenueId={activeVenueId}
                        selectedContact={selectedContact}
                        interactionScope={interactionScope}
                        interactionForm={interactionForm}
                        interactionSubmitting={interactionSubmitting}
                        interactions={interactions}
                        interactionOptions={INTERACTION_OPTIONS}
                        interactionOutcomeOptions={INTERACTION_OUTCOME_OPTIONS}
                        onInteractionScopeChange={setInteractionScope}
                        onSubmit={handleAddInteraction}
                      />
                    ),
                  },
                  {
                    key: "inventory",
                    label: "Inventory",
                    children: (
                      <ContactInventoryTab
                        activeVenueId={activeVenueId}
                        touchpointOptions={TOUCHPOINT_OPTIONS}
                        touchpointByType={touchpointByType}
                        touchpointDraft={touchpointDraft}
                        touchpointSavingType={touchpointSavingType}
                        onTouchpointChange={(touchpointType, quantity) =>
                          setTouchpointDraft((prev) => ({
                            ...prev,
                            [touchpointType]: quantity,
                          }))
                        }
                        onSaveTouchpoint={(touchpointType, quantity) => {
                          if (!Number.isInteger(quantity) || quantity < 0) {
                            message.error("Quantity must be a whole number >= 0");
                            return;
                          }
                          void saveTouchpoint(touchpointType, quantity);
                        }}
                      />
                    ),
                  },
                ]}
              />
            </Modal>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
