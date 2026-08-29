import * as migration_20241125_222020_initial from './20241125_222020_initial';
import * as migration_20241214_124128 from './20241214_124128';
import * as migration_20260222_003500_payload_3_77_compat from './20260222_003500_payload_3_77_compat';
import * as migration_20260630_000000_add_listing_unit_type from './20260630_000000_add_listing_unit_type';
import * as migration_20260714_000000_add_leads from './20260714_000000_add_leads';
import * as migration_20260715_000000_add_blog_featured_cards from './20260715_000000_add_blog_featured_cards';
import * as migration_20260716_000000_leads_crm_fields from './20260716_000000_leads_crm_fields';
import * as migration_20260716_000001_link_opens from './20260716_000001_link_opens';
import * as migration_20260717_000000_send_file from './20260717_000000_send_file';
import * as migration_20260807_000000_brochure_dwell from './20260807_000000_brochure_dwell';
import * as migration_20260817_000000_is_duplex from './20260817_000000_is_duplex';
import * as migration_20260818_000000_lead_status_site_visit_closed_won from './20260818_000000_lead_status_site_visit_closed_won';
import * as migration_20260829_000000_builder_track_record from './20260829_000000_builder_track_record';

export const migrations = [
  {
    up: migration_20241125_222020_initial.up,
    down: migration_20241125_222020_initial.down,
    name: '20241125_222020_initial',
  },
  {
    up: migration_20241214_124128.up,
    down: migration_20241214_124128.down,
    name: '20241214_124128',
  },
  {
    up: migration_20260222_003500_payload_3_77_compat.up,
    down: migration_20260222_003500_payload_3_77_compat.down,
    name: '20260222_003500_payload_3_77_compat',
  },
  {
    up: migration_20260630_000000_add_listing_unit_type.up,
    down: migration_20260630_000000_add_listing_unit_type.down,
    name: '20260630_000000_add_listing_unit_type',
  },
  {
    up: migration_20260714_000000_add_leads.up,
    down: migration_20260714_000000_add_leads.down,
    name: '20260714_000000_add_leads',
  },
  {
    up: migration_20260715_000000_add_blog_featured_cards.up,
    down: migration_20260715_000000_add_blog_featured_cards.down,
    name: '20260715_000000_add_blog_featured_cards',
  },
  {
    up: migration_20260716_000000_leads_crm_fields.up,
    down: migration_20260716_000000_leads_crm_fields.down,
    name: '20260716_000000_leads_crm_fields',
  },
  {
    up: migration_20260716_000001_link_opens.up,
    down: migration_20260716_000001_link_opens.down,
    name: '20260716_000001_link_opens',
  },
  {
    up: migration_20260717_000000_send_file.up,
    down: migration_20260717_000000_send_file.down,
    name: '20260717_000000_send_file',
  },
  {
    up: migration_20260807_000000_brochure_dwell.up,
    down: migration_20260807_000000_brochure_dwell.down,
    name: '20260807_000000_brochure_dwell',
  },
  {
    up: migration_20260817_000000_is_duplex.up,
    down: migration_20260817_000000_is_duplex.down,
    name: '20260817_000000_is_duplex',
  },
  {
    up: migration_20260818_000000_lead_status_site_visit_closed_won.up,
    down: migration_20260818_000000_lead_status_site_visit_closed_won.down,
    name: '20260818_000000_lead_status_site_visit_closed_won',
  },
  {
    up: migration_20260829_000000_builder_track_record.up,
    down: migration_20260829_000000_builder_track_record.down,
    name: '20260829_000000_builder_track_record',
  },
];
