import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ClientsService } from '../clients/clients.service';
import { UserRole } from '../users/entities/user.entity';

// Regression coverage for the heartbeat IDOR found in the production
// readiness review: POST /servers/:id/heartbeat let a CLIENT-role caller
// update ANY server's status/lastSeenAt/haVersion, not just their own —
// there was no ownership check, unlike every other CLIENT-facing mutation
// in this codebase (see AccessController.grantAccess/revokeAccess).
describe('ServersController.heartbeat', () => {
  let controller: ServersController;
  let serversService: { heartbeat: jest.Mock; findByClientId: jest.Mock };
  let clientsService: { findByUserId: jest.Mock };

  beforeEach(async () => {
    serversService = {
      heartbeat: jest.fn().mockResolvedValue(undefined),
      findByClientId: jest.fn(),
    };
    clientsService = { findByUserId: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServersController],
      providers: [
        { provide: ServersService, useValue: serversService },
        { provide: ClientsService, useValue: clientsService },
      ],
    }).compile();

    controller = module.get(ServersController);
  });

  it('rejects a CLIENT heartbeat for a server that is not theirs', async () => {
    clientsService.findByUserId.mockResolvedValue({ id: 'client-A' });
    serversService.findByClientId.mockResolvedValue([{ id: 'server-A1' }]);

    const user = { id: 'user-A', email: 'user-a@example.com', role: UserRole.CLIENT };

    await expect(
      controller.heartbeat('server-B1-not-owned', { haVersion: '2026.8.1' }, user),
    ).rejects.toThrow(ForbiddenException);

    expect(serversService.heartbeat).not.toHaveBeenCalled();
  });

  it('allows a CLIENT heartbeat for a server they actually own', async () => {
    clientsService.findByUserId.mockResolvedValue({ id: 'client-A' });
    serversService.findByClientId.mockResolvedValue([{ id: 'server-A1' }, { id: 'server-A2' }]);

    const user = { id: 'user-A', email: 'user-a@example.com', role: UserRole.CLIENT };

    await controller.heartbeat('server-A2', { haVersion: '2026.8.1' }, user);

    expect(serversService.heartbeat).toHaveBeenCalledWith('server-A2', '2026.8.1');
  });

  it('skips the ownership check entirely for ADMIN/SUPPORT — they may heartbeat any server', async () => {
    const user = { id: 'admin-1', email: 'admin@example.com', role: UserRole.ADMIN };

    await controller.heartbeat('any-server-id', { haVersion: '2026.8.1' }, user);

    expect(clientsService.findByUserId).not.toHaveBeenCalled();
    expect(serversService.heartbeat).toHaveBeenCalledWith('any-server-id', '2026.8.1');
  });
});
