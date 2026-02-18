import { permissionsFromEntitlement, permissionsFromEntitlements } from '../../domains/iam/entitlements/map';

describe('entitlement mapping', () => {
  it('WRITE deve implicar READ no mesmo submódulo', () => {
    const permissions = permissionsFromEntitlement({
      module: 'HR',
      submodule: 'HR_EMPLOYEES',
      level: 'WRITE',
    });

    expect(permissions).toContain('hr.employee.read');
    expect(permissions).toContain('hr.employee.write');
  });

  it('deve combinar permissões de múltiplos submódulos sem duplicar', () => {
    const permissions = permissionsFromEntitlements([
      { module: 'ITSM', submodule: 'ITSM_TICKETS', level: 'WRITE' },
      { module: 'ITSM', submodule: 'ITSM_REPORTS', level: 'READ' },
      { module: 'ITSM', submodule: 'ITSM_TICKETS', level: 'WRITE' },
    ]);

    expect(permissions).toContain('itsm.ticket.read');
    expect(permissions).toContain('itsm.ticket.write');
    expect(permissions).toContain('itsm.reports.read');
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});

