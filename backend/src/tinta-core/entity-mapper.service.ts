import { Injectable } from '@nestjs/common';

export type TintaEntityType =
  | 'light'
  | 'climate'
  | 'security'
  | 'switch'
  | 'cover';

export interface TintaCommand {
  entityType: TintaEntityType;
  haEntityId: string;
  action: string;
  data?: Record<string, any>;
}

export interface HACommand {
  domain: string;
  service: string;
  data: Record<string, any>;
}

@Injectable()
export class EntityMapperService {
  toHA(cmd: TintaCommand): HACommand {
    switch (cmd.entityType) {
      case 'light':
        return this.mapLight(cmd);
      case 'climate':
        return this.mapClimate(cmd);
      case 'switch':
        return this.mapSwitch(cmd);
      case 'cover':
        return this.mapCover(cmd);
      case 'security':
        return this.mapSecurity(cmd);
      default:
        throw new Error(`Unknown entity type: ${cmd.entityType}`);
    }
  }

  private mapLight(cmd: TintaCommand): HACommand {
    const service =
      cmd.action === 'on'
        ? 'turn_on'
        : cmd.action === 'off'
          ? 'turn_off'
          : 'toggle';
    return {
      domain: 'light',
      service,
      data: {
        entity_id: cmd.haEntityId,
        ...(cmd.data?.brightness !== undefined
          ? { brightness_pct: cmd.data.brightness }
          : {}),
        ...(cmd.data?.color_temp !== undefined
          ? { color_temp: cmd.data.color_temp }
          : {}),
        ...(cmd.data?.rgb_color !== undefined
          ? { rgb_color: cmd.data.rgb_color }
          : {}),
      },
    };
  }

  private mapClimate(cmd: TintaCommand): HACommand {
    if (cmd.action === 'set_temperature') {
      return {
        domain: 'climate',
        service: 'set_temperature',
        data: { entity_id: cmd.haEntityId, temperature: cmd.data?.temperature },
      };
    }
    if (cmd.action === 'set_hvac_mode') {
      return {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: cmd.haEntityId, hvac_mode: cmd.data?.mode },
      };
    }
    return {
      domain: 'climate',
      service: cmd.action,
      data: { entity_id: cmd.haEntityId, ...cmd.data },
    };
  }

  private mapSwitch(cmd: TintaCommand): HACommand {
    const service =
      cmd.action === 'on'
        ? 'turn_on'
        : cmd.action === 'off'
          ? 'turn_off'
          : 'toggle';
    return { domain: 'switch', service, data: { entity_id: cmd.haEntityId } };
  }

  private mapCover(cmd: TintaCommand): HACommand {
    const serviceMap: Record<string, string> = {
      open: 'open_cover',
      close: 'close_cover',
      stop: 'stop_cover',
      set_position: 'set_cover_position',
    };
    return {
      domain: 'cover',
      service: serviceMap[cmd.action] ?? cmd.action,
      data: {
        entity_id: cmd.haEntityId,
        ...(cmd.data?.position !== undefined
          ? { position: cmd.data.position }
          : {}),
      },
    };
  }

  private mapSecurity(cmd: TintaCommand): HACommand {
    const serviceMap: Record<string, string> = {
      arm_away: 'alarm_arm_away',
      arm_home: 'alarm_arm_home',
      disarm: 'alarm_disarm',
    };
    return {
      domain: 'alarm_control_panel',
      service: serviceMap[cmd.action] ?? cmd.action,
      data: {
        entity_id: cmd.haEntityId,
        ...(cmd.data?.code ? { code: cmd.data.code } : {}),
      },
    };
  }
}
