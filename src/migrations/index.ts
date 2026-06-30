import * as migration_20241125_222020_initial from './20241125_222020_initial';
import * as migration_20241214_124128 from './20241214_124128';
import * as migration_20260222_003500_payload_3_77_compat from './20260222_003500_payload_3_77_compat';
import * as migration_20260630_000000_add_listing_unit_type from './20260630_000000_add_listing_unit_type';

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
];
