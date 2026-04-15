import { Form, Input, InputNumber, Row, Col } from "antd";
import { useEffect, useState } from "react";
import type { Venue } from "../../types/venue";
import { getVenueOffersArray, listToText, textToList } from "./venueAdminUtils";

type Props = {
  venue: Venue;
  onPatch: (patch: Partial<Venue>) => void;
};

const stopTextareaKeyPropagation = (
  event: React.KeyboardEvent<HTMLTextAreaElement>,
) => {
  event.stopPropagation();
};

export function VenueOffersForm({ venue, onPatch }: Props) {
  const [offersText, setOffersText] = useState(() =>
    listToText(getVenueOffersArray(venue.offers)),
  );
  const [offersFocused, setOffersFocused] = useState(false);

  useEffect(() => {
    if (offersFocused) return;
    setOffersText(listToText(getVenueOffersArray(venue.offers)));
  }, [offersFocused, venue.offers]);

  return (
    <Form layout="vertical" style={{ paddingTop: 8 }}>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item label="Stars">
            <InputNumber
              min={0}
              max={5}
              step={0.1}
              controls={false}
              value={venue.stars ?? null}
              style={{ width: "100%" }}
              onChange={(value) =>
                onPatch({ stars: value === null ? undefined : Number(value) })
              }
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Reviews">
            <InputNumber
              min={0}
              controls={false}
              value={venue.reviews ?? null}
              style={{ width: "100%" }}
              onChange={(value) =>
                onPatch({ reviews: value === null ? undefined : Number(value) })
              }
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="Discount">
            <InputNumber
              min={0}
              step={0.01}
              controls={false}
              value={venue.discount ?? null}
              style={{ width: "100%" }}
              onChange={(value) =>
                onPatch({
                  discount: value === null ? undefined : Number(value),
                })
              }
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item label="Price">
            <Input
              value={venue.price || ""}
              onChange={(event) => onPatch({ price: event.target.value })}
              placeholder="Budget / Mid-range / Premium"
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Hours">
            <Input
              value={venue.hours || ""}
              onChange={(event) => onPatch({ hours: event.target.value })}
              placeholder="Open daily, 8am - 10pm"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Card perk">
        <Input.TextArea
          rows={3}
          value={venue.cardPerk || ""}
          onChange={(event) => onPatch({ cardPerk: event.target.value })}
          onKeyDown={stopTextareaKeyPropagation}
          placeholder="Describe the member perk clearly."
        />
      </Form.Item>

      <Form.Item label="Offers (one per line)">
        <Input.TextArea
          rows={4}
          value={offersText}
          onChange={(event) => setOffersText(event.target.value)}
          onFocus={() => setOffersFocused(true)}
          onBlur={() => {
            setOffersFocused(false);
            onPatch({ offers: textToList(offersText) });
          }}
          onKeyDown={stopTextareaKeyPropagation}
          placeholder={"10% Off\nWelcome drink"}
        />
      </Form.Item>

      <Form.Item label="How to claim">
        <Input.TextArea
          rows={3}
          value={venue.howToClaim || ""}
          onChange={(event) => onPatch({ howToClaim: event.target.value })}
          onKeyDown={stopTextareaKeyPropagation}
          placeholder="Explain how guests redeem the offer."
        />
      </Form.Item>

      <Form.Item label="Restrictions">
        <Input.TextArea
          rows={3}
          value={venue.restrictions || ""}
          onChange={(event) => onPatch({ restrictions: event.target.value })}
          onKeyDown={stopTextareaKeyPropagation}
          placeholder="Add any usage restrictions or terms."
        />
      </Form.Item>
    </Form>
  );
}
