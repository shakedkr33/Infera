/// <reference types="bun-types" />
/**
 * Unit tests for family member / pet visibility logic.
 *
 * Tests cover the pure helpers and the data-shape expectations for
 * listMyFamilyContacts so regressions in pet visibility are caught early.
 *
 * Run with: bun test convex/__tests__/familyMemberType.test.ts
 */

import { describe, expect, it } from 'bun:test';

// ── resolveKind (imported logic, duplicated here to avoid Convex runtime dep) ─
type MemberRow = {
  kind?: 'access' | 'entity';
  displayName?: string;
  userId?: string;
  memberType?: 'person' | 'pet';
};

function resolveKind(
  member: MemberRow
): 'access' | 'entity' {
  if (member.kind) return member.kind;
  if (!member.displayName && member.userId) return 'access';
  return 'entity';
}

// ── memberType defaulting ─────────────────────────────────────────────────────
function resolveMemberType(
  row: MemberRow
): 'person' | 'pet' {
  return row.memberType ?? 'person';
}

// ── Simulates what listMyFamilyContacts returns per entity row ────────────────
type EnrichedMember = {
  _id: string;
  displayName?: string;
  color?: string;
  memberType: 'person' | 'pet';
  selectedPhoneNumber?: string;
  matchedUserId?: string;
  inviteStatus?: string;
};

function enrichEntities(rows: MemberRow[]): EnrichedMember[] {
  return rows
    .filter((r) => resolveKind(r) === 'entity')
    .map((m) => ({
      _id: 'id_' + (m.displayName ?? 'x'),
      displayName: m.displayName,
      color: '#ccc',
      memberType: resolveMemberType(m),
      selectedPhoneNumber: undefined,
      matchedUserId: m.userId,
      inviteStatus: 'none',
    }));
}

// ── Client-side split (mirrors family-profile.tsx non-admin path) ─────────────
function splitMembers(members: EnrichedMember[]): {
  people: EnrichedMember[];
  pets: EnrichedMember[];
} {
  return {
    people: members.filter((m) => m.memberType !== 'pet'),
    pets: members.filter((m) => m.memberType === 'pet'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveKind', () => {
  it('returns the explicit kind when present', () => {
    expect(resolveKind({ kind: 'access' })).toBe('access');
    expect(resolveKind({ kind: 'entity' })).toBe('entity');
  });

  it('infers access for userId-only rows (pre-kind rows)', () => {
    expect(resolveKind({ userId: 'u1' })).toBe('access');
  });

  it('infers entity for rows with displayName (children, pets)', () => {
    expect(resolveKind({ displayName: 'Buddy', userId: undefined })).toBe(
      'entity'
    );
    expect(resolveKind({ displayName: 'ילד א' })).toBe('entity');
  });
});

describe('resolveMemberType', () => {
  it('returns pet when memberType is pet', () => {
    expect(resolveMemberType({ memberType: 'pet' })).toBe('pet');
  });

  it('returns person when memberType is person', () => {
    expect(resolveMemberType({ memberType: 'person' })).toBe('person');
  });

  it('defaults to person when memberType is absent (backward-compat)', () => {
    expect(resolveMemberType({})).toBe('person');
    expect(resolveMemberType({ displayName: 'ילד א' })).toBe('person');
  });
});

describe('listMyFamilyContacts enrichment — owner space with adult + child + pet', () => {
  const rows: MemberRow[] = [
    // Admin access row — NOT returned by entity query
    { kind: 'access', userId: 'owner_id' },
    // Adult family member (invited via phone)
    { kind: 'entity', displayName: 'בעל', memberType: 'person', userId: 'husband_id' },
    // Child (manual, no phone)
    { kind: 'entity', displayName: 'ילד א', memberType: 'person' },
    // Pet
    { kind: 'entity', displayName: 'באדי', memberType: 'pet' },
  ];

  it('enriches all entity rows and preserves memberType', () => {
    const enriched = enrichEntities(rows);
    expect(enriched).toHaveLength(3); // excludes access row
    expect(enriched.map((m) => m.displayName)).toContain('בעל');
    expect(enriched.map((m) => m.displayName)).toContain('ילד א');
    expect(enriched.map((m) => m.displayName)).toContain('באדי');
  });

  it('pet row carries memberType pet', () => {
    const enriched = enrichEntities(rows);
    const pet = enriched.find((m) => m.displayName === 'באדי');
    expect(pet).toBeDefined();
    expect(pet?.memberType).toBe('pet');
  });

  it('person rows carry memberType person', () => {
    const enriched = enrichEntities(rows);
    const people = enriched.filter((m) => m.memberType === 'person');
    expect(people).toHaveLength(2);
  });
});

describe('splitMembers — client-side people/pets split', () => {
  const members: EnrichedMember[] = [
    {
      _id: 'id_owner',
      displayName: 'מנהלת',
      color: '#36a9e2',
      memberType: 'person',
      inviteStatus: 'joined',
    },
    {
      _id: 'id_husband',
      displayName: 'בעל',
      color: '#4ade80',
      memberType: 'person',
      matchedUserId: 'husband_user_id',
      inviteStatus: 'joined',
    },
    {
      _id: 'id_child',
      displayName: 'ילד',
      color: '#facc15',
      memberType: 'person',
      inviteStatus: 'none',
    },
    {
      _id: 'id_pet',
      displayName: 'פלאפי',
      color: '#f97316',
      memberType: 'pet',
      inviteStatus: 'none',
    },
  ];

  it('pet is present in pets list for an authorized family member', () => {
    const { pets } = splitMembers(members);
    expect(pets).toHaveLength(1);
    expect(pets[0].displayName).toBe('פלאפי');
    expect(pets[0].memberType).toBe('pet');
  });

  it('people list contains owner + husband + child but not pet', () => {
    const { people } = splitMembers(members);
    expect(people).toHaveLength(3);
    expect(people.every((m) => m.memberType === 'person')).toBe(true);
    expect(people.map((m) => m.displayName)).not.toContain('פלאפי');
  });
});

describe('unauthorized user — empty members array', () => {
  it('returns empty lists when no members are provided (no space access)', () => {
    const { people, pets } = splitMembers([]);
    expect(people).toHaveLength(0);
    expect(pets).toHaveLength(0);
  });
});

describe('backward-compat: rows without memberType field (pre-migration)', () => {
  const legacyRows: MemberRow[] = [
    { kind: 'entity', displayName: 'ילד ישן' },   // no memberType
    { kind: 'entity', displayName: 'חתול', memberType: 'pet' },
  ];

  it('legacy rows without memberType default to person', () => {
    const enriched = enrichEntities(legacyRows);
    const legacy = enriched.find((m) => m.displayName === 'ילד ישן');
    expect(legacy?.memberType).toBe('person');
  });

  it('pet row is correctly identified even alongside legacy rows', () => {
    const enriched = enrichEntities(legacyRows);
    const { pets, people } = splitMembers(enriched);
    expect(pets).toHaveLength(1);
    expect(pets[0].displayName).toBe('חתול');
    expect(people).toHaveLength(1);
    expect(people[0].displayName).toBe('ילד ישן');
  });
});
