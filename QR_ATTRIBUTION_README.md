# QR Attribution And Purchase Tracking

This document explains how QR attribution moves from the first scan through to confirmed purchase revenue in GA4, and how that data is intended to support the QR dashboard.

## Overview

There are two related attribution layers in this setup:

1. Standard UTM-based session attribution
2. Custom purchase-event attribution

The first layer is used for traffic and CTA reporting.
The second layer is used for purchase and revenue reporting.

The key idea is that the original QR UTM values are preserved and copied forward so purchases can still be tied back to the same QR placement.

## End-To-End Flow

```text
QR Code
  ->
qr.ahangama.com redirect
  ->
ahangama.com landing URL with UTMs
  - utm_source=qr
  - utm_medium=offline
  - utm_campaign=qr_launch_2026
  - utm_content=viji-test__ps
  - utm_term=h
  ->
GA4 session attribution on the visit
  - sessionManualSource = qr
  - sessionManualMedium = offline
  - sessionManualAdContent = viji-test__ps
  ->
Pass CTA click on ahangama.com
  ->
pass.ahangama.com receives and stores same attribution
  - utm_source
  - utm_medium
  - utm_campaign
  - utm_content
  - utm_term
  - parsed into qr_venue / qr_surface / qr_creative
  ->
create-checkout-session
  ->
Stripe Checkout Session metadata
  - qr_source = qr
  - qr_medium = offline
  - qr_campaign = qr_launch_2026
  - qr_content = viji-test__ps
  - qr_goal = h
  - qr_venue = viji-test
  - qr_surface = ps
  - qr_creative = ...
  - qr_landing_page = ...
  ->
Stripe payment completes
  ->
pass webhook runs
  ->
server-side GA4 purchase event
  - event name = purchase
  - transaction_id = payment_intent.id
  - value = purchase amount
  - currency = USD
  - qr_content = viji-test__ps
  - qr_goal = h
  - qr_venue = viji-test
  - qr_surface = ps
  - qr_landing_page = ...
  ->
GA4 custom dimensions
  - customEvent:qr_content
  - customEvent:qr_goal
  - customEvent:qr_venue
  - customEvent:qr_surface
  - customEvent:qr_landing_page
  ->
QR dashboard can join:
  traffic + CTAs from session UTMs
  with
  purchases + revenue from custom purchase params
```

## UTM Contract

The QR redirect service produces the canonical acquisition payload:

- `utm_source=qr`
- `utm_medium=offline`
- `utm_campaign=qr_launch_2026`
- `utm_content=<venue>__<surface>__<creative>`
- `utm_term=<goal>`

Example:

```text
https://ahangama.com/?utm_source=qr&utm_medium=offline&utm_campaign=qr_launch_2026&utm_content=viji-test__ps&utm_term=h
```

These values are the source of truth for QR acquisition.

## How UTM Data Maps To GA4 Session Reporting

When the user lands on ahangama.com with UTMs, GA4 uses those values for session attribution.

The important session-side fields are:

- `utm_source` -> `sessionManualSource`
- `utm_medium` -> `sessionManualMedium`
- `utm_content` -> `sessionManualAdContent`

That is why the QR dashboard can already report traffic and CTA behavior by QR placement using session-scoped dimensions.

Example:

- `sessionManualSource = qr`
- `sessionManualMedium = offline`
- `sessionManualAdContent = viji-test__ps`

## How UTM Data Maps To Purchase Event Parameters

When the user moves into pass.ahangama.com, the pass app captures the original UTM values and preserves them through checkout.

At checkout creation, the backend writes them into Stripe metadata under purchase-safe QR keys:

- `utm_source` -> `qr_source`
- `utm_medium` -> `qr_medium`
- `utm_campaign` -> `qr_campaign`
- `utm_content` -> `qr_content`
- `utm_term` -> `qr_goal`

It also parses `utm_content` into structured fields:

- `qr_venue`
- `qr_surface`
- `qr_creative`

Example:

- `utm_content = viji-test__ps`
- `qr_content = viji-test__ps`
- `qr_venue = viji-test`
- `qr_surface = ps`
- `qr_creative = ""`

## Why Both Session Fields And Custom Purchase Fields Exist

Both layers are necessary because they serve different purposes.

Session attribution is best for:

- scans
- visits
- CTA clicks
- landing behavior

Custom purchase parameters are best for:

- confirmed purchases
- revenue
- webhook-sent server-side events
- joining purchase outcomes back to QR placements

Without the custom purchase parameters, the final `purchase` event would exist in GA4 but would not reliably carry the original QR placement information in a way the dashboard can use.

## The Most Important Join Key

The most important attribution field in the whole setup is the raw placement key:

- traffic side: `utm_content`
- session reporting side: `sessionManualAdContent`
- purchase side: `qr_content`

These should all carry the same logical value.

Example:

- `utm_content = viji-test__ps`
- `sessionManualAdContent = viji-test__ps`
- `qr_content = viji-test__ps`

That raw key is what allows the QR dashboard to join:

- traffic
- CTA clicks
- purchases
- revenue

## GA4 Custom Dimensions Used For Purchase Reporting

To make purchase events queryable in the GA4 Data API, the following event-scoped custom dimensions were created:

- `customEvent:pass_type`
- `customEvent:promo_type`
- `customEvent:qr_content`
- `customEvent:qr_creative`
- `customEvent:qr_goal`
- `customEvent:qr_landing_page`
- `customEvent:qr_surface`
- `customEvent:qr_venue`

These are needed because the purchase event is emitted server-side from the Stripe webhook, not just from the original browser session.

## Why Realtime And Data API Can Disagree Temporarily

GA4 Realtime can show purchase event parameters before the standard Data API makes those same events available in normal reports.

That means you may see:

- `purchase` in Realtime
- `qr_venue = viji-test` in Realtime
- `transaction_id` in Realtime
- `value` in Realtime

while the Data API still returns no purchase row for the same event.

This is a reporting delay, not necessarily an implementation failure.

## Dashboard Reporting Model

The intended reporting model is:

Traffic and CTA reporting:

- use GA4 session attribution fields from the original UTM visit
- examples: `sessionManualSource`, `sessionManualMedium`, `sessionManualAdContent`

Purchase and revenue reporting:

- use GA4 custom purchase-event dimensions and purchase metrics
- examples: `customEvent:qr_content`, `customEvent:qr_landing_page`
- metrics: `transactions`, `purchaseRevenue`

In practice, the dashboard should eventually join:

- traffic and CTA rows from session attribution
- purchase and revenue rows from custom purchase parameters

## Summary

Use this mental model:

- `utm_*` drives acquisition and session attribution
- `qr_*` is the preserved purchase-safe copy of that same attribution on the server-side purchase event

And use this join key as the backbone of reporting:

- `utm_content` / `sessionManualAdContent` / `qr_content`

If these remain aligned, QR scan traffic and confirmed purchase revenue can be tied back to the same venue and surface placement.
