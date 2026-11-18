# Database Schema Documentation

Custodia utilizes SQLite as its default zero-configuration database (with full PostgreSQL compatibility when `DATABASE_URL` is configured). All tables are created idempotently with `CREATE TABLE IF NOT EXISTS` and indexed for sub-millisecond retrieval.

---

## 1. Brand Governance & Preflight Tables

### `organizations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (e.g. `org_inkloom_demo`) |
| `name` | TEXT | NOT NULL | Human-readable name |
| `slug` | TEXT | UNIQUE NOT NULL | URL-safe slug |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

### `memberships`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (`mem_*`) |
| `org_id` | TEXT | FOREIGN KEY `organizations(id)` | Organization reference |
| `user_id` | TEXT | NOT NULL | User identifier |
| `role` | TEXT | NOT NULL | `CREATOR`, `REVIEWER`, `BRAND_MANAGER`, `ADMIN` |
| `created_at` | TIMESTAMP | NOT NULL | Membership creation timestamp |

### `brand_profiles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (`bp_*`) |
| `org_id` | TEXT | FOREIGN KEY `organizations(id)` | Parent organization |
| `name` | TEXT | NOT NULL | Brand profile name |
| `tagline` | TEXT | | Brand tagline |
| `description` | TEXT | | Scope and target guidelines |
| `tone_guidelines_json` | TEXT | | JSON array of tone requirements |
| `target_audience` | TEXT | | Primary audience |
| `primary_colors_json` | TEXT | | JSON array of hex codes (`["#14213D", "#00F0FF"]`) |
| `font_families_json` | TEXT | | JSON array of typography families |
| `is_active` | INTEGER | DEFAULT 1 | Active status boolean flag |
| `created_at` | TIMESTAMP | NOT NULL | Profile creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Profile update timestamp |

### `brand_rules`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (`rule_*`) |
| `org_id` | TEXT | NOT NULL | Organization ID |
| `brand_profile_id` | TEXT | FOREIGN KEY `brand_profiles(id)` | Parent brand profile |
| `category` | TEXT | NOT NULL | `TERMINOLOGY`, `MESSAGING`, `FACTS`, `CLAIMS`, `LEGAL`, `VISUAL`, `ACCESSIBILITY` |
| `enforcement` | TEXT | NOT NULL | `STRICT`, `WARNING`, `ADVISORY` |
| `title` | TEXT | NOT NULL | Rule display name |
| `rule_text` | TEXT | NOT NULL | Full operational policy statement |
| `explanation` | TEXT | | Rationale and regulatory justification |
| `forbidden_patterns_json`| TEXT | | JSON array of flagged substrings/regex |
| `preferred_alternatives_json`| TEXT | | JSON array of replacement phrasing |
| `required_disclaimers_json`| TEXT | | Mandatory footnotes/disclaimers |
| `source_document` | TEXT | | Original uploaded guideline filename |
| `source_location` | TEXT | | Citation (page, section, table cell) |
| `status` | TEXT | DEFAULT 'active' | `ACTIVE`, `INACTIVE`, `EXTRACTED`, `DRAFT` |
| `version` | INTEGER | DEFAULT 1 | Current rule version counter |
| `created_at` | TIMESTAMP | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last modification timestamp |

### `brand_rule_versions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique version ID (`v_*`) |
| `rule_id` | TEXT | FOREIGN KEY `brand_rules(id)` | Parent rule ID |
| `version` | INTEGER | NOT NULL | Historical version number |
| `title` | TEXT | NOT NULL | Rule title at time of snapshot |
| `rule_text` | TEXT | NOT NULL | Rule text snapshot |
| `enforcement` | TEXT | NOT NULL | Enforcement level snapshot |
| `change_summary` | TEXT | | Description of change |
| `created_by` | TEXT | | User/system actor ID |
| `created_at` | TIMESTAMP | NOT NULL | Snapshot timestamp |

### `approved_facts`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (`fact_*`) |
| `org_id` | TEXT | NOT NULL | Organization reference |
| `brand_profile_id` | TEXT | FOREIGN KEY `brand_profiles(id)` | Brand profile reference |
| `category` | TEXT | NOT NULL | `PRICING`, `METRIC`, `PRODUCT`, `DISCLAIMER`, `COHORT`, `DATES` |
| `entity_name` | TEXT | NOT NULL | Subject name (e.g. "Monthly Subscription") |
| `canonical_value` | TEXT | NOT NULL | Authorized value string (e.g. "₹999") |
| `canonical_number` | REAL | | Parsed numeric representation (e.g. 999.0) |
| `canonical_unit` | TEXT | | Currency or unit (e.g. "INR", "%") |
| `statement` | TEXT | NOT NULL | Approved claim sentence |
| `proof_citation` | TEXT | | Authoritative citation |
| `valid_from` | TEXT | | Optional start date |
| `valid_to` | TEXT | | Optional expiration date |
| `is_active` | INTEGER | DEFAULT 1 | Active ground truth flag |
| `created_at` | TIMESTAMP | NOT NULL | Timestamp |

### `brand_assets`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique ID (`asset_*`) |
| `org_id` | TEXT | NOT NULL | Organization reference |
| `brand_profile_id` | TEXT | FOREIGN KEY `brand_profiles(id)` | Brand profile reference |
| `name` | TEXT | NOT NULL | Asset name |
| `asset_type` | TEXT | NOT NULL | `LOGO`, `IMAGE`, `PALETTE`, `FONT`, `TEMPLATE` |
| `file_path` | TEXT | | Local disk storage path |
| `file_url` | TEXT | | Public/served asset URL |
| `mime_type` | TEXT | DEFAULT 'image/png'| MIME type |
| `sha256` | TEXT | | Cryptographic fingerprint |
| `hex_colors_json` | TEXT | | Extracted / approved hex palette codes |
| `dimensions_json` | TEXT | | Width, height metadata |
| `usage_guidelines` | TEXT | | Clear-space, background placement rules |
| `is_active` | INTEGER | DEFAULT 1 | Active asset flag |
| `created_at` | TIMESTAMP | NOT NULL | Timestamp |

### `preflight_reviews`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique review ID (`prev_*`) |
| `org_id` | TEXT | NOT NULL | Organization ID |
| `brand_profile_id` | TEXT | FOREIGN KEY `brand_profiles(id)` | Brand profile ID |
| `title` | TEXT | NOT NULL | Submission title |
| `content_raw` | TEXT | NOT NULL | Submitted copy (or active corrected copy) |
| `category` | TEXT | NOT NULL | `AD`, `SOCIAL_MEDIA`, `LANDING_PAGE`, `PRODUCT_COPY`, etc. |
| `channels_json` | TEXT | | Channels array (`["social", "display"]`) |
| `workflow_status` | TEXT | NOT NULL | `DRAFT`, `NEEDS_REVISION`, `PENDING_REVIEW`, `APPROVED`, etc. |
| `overall_score` | INTEGER | NOT NULL | Compliance score (0-100) |
| `risk_tier` | TEXT | NOT NULL | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `findings_json` | TEXT | NOT NULL | JSON array of PreflightFinding objects |
| `corrected_content` | TEXT | | Auto-generated corrected text |
| `metadata_json` | TEXT | | Visual inspection and channel telemetry |
| `created_by` | TEXT | | Submitting creator ID |
| `reviewer_id` | TEXT | | Reviewer who recorded sign-off |
| `reviewer_decision` | TEXT | | `APPROVED`, `APPROVED_WITH_CONDITIONS`, `REJECTED` |
| `reviewer_notes` | TEXT | | Human reviewer feedback / justification |
| `created_at` | TIMESTAMP | NOT NULL | Submission timestamp |
| `updated_at` | TIMESTAMP | NOT NULL | Last update timestamp |

### `audit_events`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique hash (`evt_*`) |
| `org_id` | TEXT | NOT NULL | Organization ID |
| `actor_id` | TEXT | NOT NULL | Acting user or system component |
| `actor_role` | TEXT | NOT NULL | Role at time of action (`CREATOR`, `REVIEWER`, `ADMIN`) |
| `action` | TEXT | NOT NULL | Action type (`PREFLIGHT_ANALYSIS`, `DECISION_APPROVED`, etc.) |
| `target_type` | TEXT | NOT NULL | Target entity type (`preflight_review`, `brand_rule`) |
| `target_id` | TEXT | NOT NULL | Target entity identifier |
| `details_json` | TEXT | | Contextual snapshot data |
| `created_at` | TIMESTAMP | NOT NULL | Timestamp |

---

## 2. Legacy Preservation Tables
The following tables are preserved to maintain 100% backward compatibility with existing Custodia claim verification tests:
- `reviews`
- `users`
- `sessions`
- `anon_usage`
- `revisions`
