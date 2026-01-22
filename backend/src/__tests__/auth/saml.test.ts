import { mapGroupsToRole, parseRoleMapping, isEmailAllowed } from '../../auth/saml';
import { UserRole } from '@prisma/client';

describe('saml helpers', () => {
  it('maps highest privilege role when multiple groups match', () => {
    const mapping = parseRoleMapping(
      JSON.stringify({
        'group-admins@empresa.com': 'ADMIN',
        'group-techs@empresa.com': 'TECHNICIAN',
      })
    );
    const role = mapGroupsToRole(
      ['group-techs@empresa.com', 'group-admins@empresa.com'],
      mapping,
      UserRole.REQUESTER
    );
    expect(role).toBe(UserRole.ADMIN);
  });

  it('falls back to default role when no group matches', () => {
    const mapping = parseRoleMapping(
      JSON.stringify({
        'group-triage@empresa.com': 'TRIAGER',
      })
    );
    const role = mapGroupsToRole(['other@empresa.com'], mapping, UserRole.REQUESTER);
    expect(role).toBe(UserRole.REQUESTER);
  });

  it('validates allowed domains', () => {
    expect(isEmailAllowed('user@empresa.com', ['empresa.com'])).toBe(true);
    expect(isEmailAllowed('user@other.com', ['empresa.com'])).toBe(false);
  });
});
