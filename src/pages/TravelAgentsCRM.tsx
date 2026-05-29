import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  makeGmailComposeUrl,
  makeWhatsAppUrl,
} from "../components/crm/contactLinks";
import type {
  InteractionOutcome,
  InteractionType,
  TravelAgentCompany,
  TravelAgentContact,
  TravelAgentInteraction,
} from "../types/crm";

const COMPANIES_LIST_ENDPOINT = "/.netlify/functions/api-travel-agent-companies-list";
const COMPANIES_CREATE_ENDPOINT = "/.netlify/functions/api-travel-agent-companies-create";
const COMPANIES_UPDATE_ENDPOINT = "/.netlify/functions/api-travel-agent-companies-update";
const CONTACTS_CREATE_ENDPOINT = "/.netlify/functions/api-travel-agent-contacts-create";
const CONTACTS_UPDATE_ENDPOINT = "/.netlify/functions/api-travel-agent-contacts-update";
const INTERACTIONS_LIST_ENDPOINT = "/.netlify/functions/api-travel-agent-interactions-list";
const INTERACTIONS_CREATE_ENDPOINT = "/.netlify/functions/api-travel-agent-interactions-create";

type TravelAgentCompanyRecord = TravelAgentCompany & {
  contacts: TravelAgentContact[];
};

type ContactFormValues = {
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  whatsapp?: string;
  phone?: string;
  notes?: string;
  emailSent?: boolean;
  active?: boolean;
};

type CompanyFormValues = {
  companyName: string;
  notes?: string;
  active?: boolean;
};

type InteractionFormValues = {
  interactionType: InteractionType;
  outcomeStatus: InteractionOutcome;
  summary: string;
  feedback?: string;
  nextAction?: string;
  nextFollowUpAt?: Dayjs;
};

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

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  } & T;

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload;
}

function companyToFormValues(company: TravelAgentCompanyRecord): CompanyFormValues {
  return {
    companyName: company.companyName,
    notes: company.notes || "",
    active: company.active,
  };
}

function contactToFormValues(contact: TravelAgentContact): ContactFormValues {
  return {
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    fullName: contact.fullName,
    email: contact.email || "",
    whatsapp: contact.whatsapp || "",
    phone: contact.phone || "",
    notes: contact.notes || "",
    emailSent: contact.emailSent,
    active: contact.active,
  };
}

export default function TravelAgentsCRM() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<TravelAgentCompanyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [interactions, setInteractions] = useState<TravelAgentInteraction[]>([]);
  const [interactionScope, setInteractionScope] = useState<"contact" | "company">("contact");
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<TravelAgentContact | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [companyForm] = Form.useForm<CompanyFormValues>();
  const [companyCreateForm] = Form.useForm<CompanyFormValues>();
  const [contactForm] = Form.useForm<ContactFormValues>();
  const [interactionForm] = Form.useForm<InteractionFormValues>();

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const selectedContact = useMemo(
    () =>
      selectedCompany?.contacts.find((contact) => contact.id === selectedContactId) ||
      null,
    [selectedCompany, selectedContactId],
  );

  const loadCompanies = async (query = search) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchJson<{ companies: TravelAgentCompanyRecord[] }>(
        `${COMPANIES_LIST_ENDPOINT}?q=${encodeURIComponent(query)}`,
      );
      setCompanies(response.companies || []);
    } catch (loadError) {
      setError(String((loadError as Error)?.message || loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadInteractions = async (
    companyId: string,
    contactId: string,
    scope: "contact" | "company",
  ) => {
    if (!companyId) {
      setInteractions([]);
      return;
    }

    const params = new URLSearchParams({ companyId });
    if (scope === "contact" && contactId) {
      params.set("contactId", contactId);
    }

    try {
      const response = await fetchJson<{ interactions: TravelAgentInteraction[] }>(
        `${INTERACTIONS_LIST_ENDPOINT}?${params.toString()}`,
      );
      setInteractions(response.interactions || []);
    } catch (loadError) {
      message.error(String((loadError as Error)?.message || loadError));
    }
  };

  useEffect(() => {
    void loadCompanies("");
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCompanies(search);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!companies.length) {
      setSelectedCompanyId("");
      setSelectedContactId("");
      companyForm.resetFields();
      return;
    }

    const activeCompany = companies.find((company) => company.id === selectedCompanyId);
    const nextCompany = activeCompany || companies[0];
    if (nextCompany.id !== selectedCompanyId) {
      setSelectedCompanyId(nextCompany.id);
    }

    companyForm.setFieldsValue(companyToFormValues(nextCompany));

    const activeContact = nextCompany.contacts.find(
      (contact) => contact.id === selectedContactId,
    );
    const nextContact = activeContact || nextCompany.contacts[0] || null;
    setSelectedContactId(nextContact?.id || "");
  }, [companies, selectedCompanyId, selectedContactId, companyForm]);

  useEffect(() => {
    void loadInteractions(selectedCompanyId, selectedContactId, interactionScope);
  }, [selectedCompanyId, selectedContactId, interactionScope]);

  const handleCreateCompany = async (values: CompanyFormValues) => {
    setSavingCompany(true);
    try {
      await fetchJson(COMPANIES_CREATE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(values),
      });
      message.success("Company created");
      setCompanyModalOpen(false);
      companyCreateForm.resetFields();
      await loadCompanies(search);
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSavingCompany(false);
    }
  };

  const handleUpdateCompany = async (values: CompanyFormValues) => {
    if (!selectedCompany) return;

    setSavingCompany(true);
    try {
      await fetchJson(COMPANIES_UPDATE_ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify({
          id: selectedCompany.id,
          ...values,
        }),
      });
      message.success("Company updated");
      await loadCompanies(search);
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSavingCompany(false);
    }
  };

  const openCreateContact = () => {
    if (!selectedCompany) {
      message.error("Select a company first");
      return;
    }
    setEditingContact(null);
    contactForm.setFieldsValue({
      fullName: "",
      firstName: "",
      lastName: "",
      email: "",
      whatsapp: "",
      phone: "",
      notes: "",
      emailSent: false,
      active: true,
    });
    setContactModalOpen(true);
  };

  const openEditContact = (contact: TravelAgentContact) => {
    setEditingContact(contact);
    contactForm.setFieldsValue(contactToFormValues(contact));
    setContactModalOpen(true);
  };

  const handleSaveContact = async (values: ContactFormValues) => {
    if (!selectedCompany) {
      message.error("Select a company first");
      return;
    }

    setSavingContact(true);
    try {
      const endpoint = editingContact
        ? CONTACTS_UPDATE_ENDPOINT
        : CONTACTS_CREATE_ENDPOINT;
      const method = editingContact ? "PATCH" : "POST";
      await fetchJson(endpoint, {
        method,
        body: JSON.stringify({
          id: editingContact?.id,
          companyId: selectedCompany.id,
          ...values,
        }),
      });
      message.success(editingContact ? "Contact updated" : "Contact created");
      setContactModalOpen(false);
      setEditingContact(null);
      contactForm.resetFields();
      await loadCompanies(search);
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSavingContact(false);
    }
  };

  const handleLogInteraction = async (values: InteractionFormValues) => {
    if (!selectedCompany || !selectedContact) {
      message.error("Select a contact before logging a call or interaction");
      return;
    }

    setSavingInteraction(true);
    try {
      await fetchJson(INTERACTIONS_CREATE_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          companyId: selectedCompany.id,
          contactId: selectedContact.id,
          interactionType: values.interactionType,
          outcomeStatus: values.outcomeStatus,
          summary: values.summary,
          feedback: values.feedback,
          nextAction: values.nextAction,
          nextFollowUpAt: values.nextFollowUpAt
            ? values.nextFollowUpAt.toISOString()
            : null,
        }),
      });
      interactionForm.resetFields();
      interactionForm.setFieldsValue({
        interactionType: "call",
        outcomeStatus: "pending",
      });
      message.success("Interaction logged");
      await loadInteractions(selectedCompany.id, selectedContact.id, interactionScope);
    } catch (saveError) {
      message.error(String((saveError as Error)?.message || saveError));
    } finally {
      setSavingInteraction(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Travel agents
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage travel-agent companies, attached people, and call logs.
        </Typography.Text>
      </Space>

      {error ? (
        <Alert type="error" showIcon message="Travel-agent CRM unavailable" description={error} />
      ) : null}

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} lg={8}>
          <Card
            title="Companies"
            extra={<Button type="primary" onClick={() => setCompanyModalOpen(true)}>New company</Button>}
            style={{ borderRadius: 20, height: "100%" }}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  value={search}
                  placeholder="Search company, contact, email, WhatsApp"
                  onChange={(event) => setSearch(event.target.value)}
                  allowClear
                />
                <Button onClick={() => void loadCompanies(search)}>Search</Button>
              </Space.Compact>

              <List
                loading={loading}
                dataSource={companies}
                locale={{ emptyText: <Empty description="No travel-agent companies yet" /> }}
                renderItem={(company) => {
                  const isSelected = company.id === selectedCompanyId;
                  return (
                    <List.Item
                      style={{
                        cursor: "pointer",
                        paddingInline: 12,
                        borderRadius: 16,
                        background: isSelected ? "rgba(14, 116, 144, 0.08)" : undefined,
                      }}
                      onClick={() => {
                        setSelectedCompanyId(company.id);
                        setSelectedContactId(company.contacts[0]?.id || "");
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <Typography.Text strong>{company.companyName}</Typography.Text>
                            <Tag color={company.active ? "green" : "default"}>
                              {company.active ? "Active" : "Inactive"}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={2}>
                            <Typography.Text type="secondary">
                              {company.contacts.length} people attached
                            </Typography.Text>
                            {company.notes ? (
                              <Typography.Text type="secondary">{company.notes}</Typography.Text>
                            ) : null}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {selectedCompany ? (
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              <Card
                title="Company details"
                style={{ borderRadius: 20 }}
                extra={
                  <Tag color={selectedCompany.active ? "green" : "default"}>
                    {selectedCompany.active ? "Active" : "Inactive"}
                  </Tag>
                }
              >
                <Form form={companyForm} layout="vertical" onFinish={handleUpdateCompany}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="companyName"
                        label="Company name"
                        rules={[{ required: true, message: "Company name is required" }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="active" label="Status">
                        <Select
                          options={[
                            { label: "Active", value: true },
                            { label: "Inactive", value: false },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item name="notes" label="Notes">
                        <Input.TextArea rows={3} placeholder="Internal notes about this company" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button htmlType="submit" type="primary" loading={savingCompany}>
                    Save company
                  </Button>
                </Form>
              </Card>

              <Card
                title="People"
                style={{ borderRadius: 20 }}
                extra={<Button onClick={openCreateContact}>Add person</Button>}
              >
                <List
                  dataSource={selectedCompany.contacts}
                  locale={{ emptyText: "No people attached to this company yet" }}
                  renderItem={(contact) => {
                    const whatsappUrl = makeWhatsAppUrl(contact.whatsapp);
                    const gmailUrl = makeGmailComposeUrl(contact.email);
                    const isSelected = contact.id === selectedContactId;

                    return (
                      <List.Item
                        actions={[
                          <Button key="select" type={isSelected ? "primary" : "default"} onClick={() => setSelectedContactId(contact.id)}>
                            {isSelected ? "Selected" : "Select"}
                          </Button>,
                          <Button key="edit" onClick={() => openEditContact(contact)}>
                            Edit
                          </Button>,
                          whatsappUrl ? (
                            <Button key="whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                              WhatsApp
                            </Button>
                          ) : null,
                          gmailUrl ? (
                            <Button key="email" href={gmailUrl} target="_blank" rel="noreferrer">
                              Email
                            </Button>
                          ) : null,
                        ].filter(Boolean)}
                        style={{
                          paddingInline: 12,
                          borderRadius: 16,
                          background: isSelected ? "rgba(15, 23, 42, 0.04)" : undefined,
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <Typography.Text strong>{contact.fullName}</Typography.Text>
                              {contact.emailSent ? <Tag color="blue">Email sent</Tag> : null}
                              <Tag color={contact.active ? "green" : "default"}>
                                {contact.active ? "Active" : "Inactive"}
                              </Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              {contact.email ? (
                                <Typography.Text type="secondary">{contact.email}</Typography.Text>
                              ) : null}
                              {contact.whatsapp ? (
                                <Typography.Text type="secondary">
                                  WhatsApp: {contact.whatsapp}
                                </Typography.Text>
                              ) : null}
                              {contact.phone ? (
                                <Typography.Text type="secondary">Phone: {contact.phone}</Typography.Text>
                              ) : null}
                              {contact.notes ? (
                                <Typography.Text type="secondary">{contact.notes}</Typography.Text>
                              ) : null}
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </Card>

              <Card
                title="Call log"
                style={{ borderRadius: 20 }}
                extra={
                  <Segmented
                    value={interactionScope}
                    onChange={(value) =>
                      setInteractionScope(value as "contact" | "company")
                    }
                    options={[
                      { label: "Selected contact", value: "contact" },
                      { label: "Whole company", value: "company" },
                    ]}
                  />
                }
              >
                {selectedContact ? (
                  <Space direction="vertical" size={20} style={{ width: "100%" }}>
                    <Typography.Text type="secondary">
                      New interactions will be logged against {selectedContact.fullName}.
                    </Typography.Text>

                    <Form
                      form={interactionForm}
                      layout="vertical"
                      onFinish={handleLogInteraction}
                      initialValues={{
                        interactionType: "call",
                        outcomeStatus: "pending",
                      }}
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={6}>
                          <Form.Item
                            name="interactionType"
                            label="Type"
                            rules={[{ required: true, message: "Type is required" }]}
                          >
                            <Select options={INTERACTION_OPTIONS} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item
                            name="outcomeStatus"
                            label="Outcome"
                            rules={[{ required: true, message: "Outcome is required" }]}
                          >
                            <Select options={INTERACTION_OUTCOME_OPTIONS} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="summary"
                            label="Summary"
                            rules={[{ required: true, message: "Summary is required" }]}
                          >
                            <Input placeholder="Called to discuss availability and next steps" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="feedback" label="Notes">
                            <Input.TextArea rows={2} placeholder="Context from the call or follow-up" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="nextAction" label="Next action">
                            <Input placeholder="Send rates" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="nextFollowUpAt" label="Follow-up date">
                            <DatePicker showTime style={{ width: "100%" }} format="YYYY-MM-DD HH:mm" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button htmlType="submit" type="primary" loading={savingInteraction}>
                        Log interaction
                      </Button>
                    </Form>

                    <List
                      dataSource={interactions}
                      locale={{ emptyText: "No call log entries yet" }}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space wrap>
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
                              <Space direction="vertical" size={2}>
                                <Typography.Text type="secondary">
                                  {dayjs(item.interactionAt).format("YYYY-MM-DD HH:mm")}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  Contact: {item.contactName || "Unknown"}
                                </Typography.Text>
                                {item.nextAction ? (
                                  <Typography.Text type="secondary">
                                    Next: {item.nextAction}
                                  </Typography.Text>
                                ) : null}
                                {item.nextFollowUpAt ? (
                                  <Typography.Text type="secondary">
                                    Follow-up: {dayjs(item.nextFollowUpAt).format("YYYY-MM-DD HH:mm")}
                                  </Typography.Text>
                                ) : null}
                                {item.feedback ? (
                                  <Typography.Text type="secondary">{item.feedback}</Typography.Text>
                                ) : null}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Space>
                ) : (
                  <Empty description="Select or create a contact to start logging calls" />
                )}
              </Card>
            </Space>
          ) : (
            <Card style={{ borderRadius: 20 }}>
              <Empty description="Create or select a company to begin" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        open={companyModalOpen}
        title="New company"
        onCancel={() => {
          setCompanyModalOpen(false);
          companyCreateForm.resetFields();
        }}
        onOk={() => companyCreateForm.submit()}
        okText="Create company"
        confirmLoading={savingCompany}
      >
        <Form form={companyCreateForm} layout="vertical" onFinish={handleCreateCompany}>
          <Form.Item
            name="companyName"
            label="Company name"
            rules={[{ required: true, message: "Company name is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="active" label="Status" initialValue>
            <Select
              options={[
                { label: "Active", value: true },
                { label: "Inactive", value: false },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={contactModalOpen}
        title={editingContact ? "Edit person" : "Add person"}
        onCancel={() => {
          setContactModalOpen(false);
          setEditingContact(null);
          contactForm.resetFields();
        }}
        onOk={() => contactForm.submit()}
        okText={editingContact ? "Save changes" : "Create person"}
        confirmLoading={savingContact}
      >
        <Form form={contactForm} layout="vertical" onFinish={handleSaveContact}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="firstName" label="First name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Last name">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="fullName"
            label="Full name"
            rules={[{ required: true, message: "Full name is required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="whatsapp" label="WhatsApp number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Landline number">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="emailSent" label="Email sent">
                <Select
                  options={[
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="active" label="Status">
                <Select
                  options={[
                    { label: "Active", value: true },
                    { label: "Inactive", value: false },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}