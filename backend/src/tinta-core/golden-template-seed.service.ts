import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoldenTemplate } from './entities/golden-template.entity';

const DEFAULT_TEMPLATES = [
  {
    slug: 'lighting-motion-hall',
    name: 'Авто-свет в коридоре',
    description: 'Включает свет в коридоре при обнаружении движения, выключает через 3 минуты',
    requiredEntities: ['binary_sensor', 'light'],
    automation: {
      alias: 'Tinta: Авто-свет в коридоре',
      mode: 'restart',
      trigger: [
        { platform: 'state', entity_id: 'binary_sensor.motion_hall', to: 'on' },
      ],
      action: [
        { service: 'light.turn_on', target: { area_id: 'hall' }, data: { brightness_pct: 80 } },
        { delay: { minutes: 3 } },
        { service: 'light.turn_off', target: { area_id: 'hall' } },
      ],
    },
  },
  {
    slug: 'climate-schedule',
    name: 'Расписание климата',
    description: 'Утром +21°C, ночью +18°C. Экономит ~15% на отоплении',
    requiredEntities: ['climate'],
    automation: {
      alias: 'Tinta: Расписание климата',
      mode: 'single',
      trigger: [
        { platform: 'time', at: '07:00:00' },
        { platform: 'time', at: '22:00:00' },
      ],
      action: [
        {
          choose: [
            {
              conditions: [{ condition: 'time', after: '07:00:00', before: '22:00:00' }],
              sequence: [{ service: 'climate.set_temperature', target: { entity_id: 'climate.living_room' }, data: { temperature: 21 } }],
            },
          ],
          default: [{ service: 'climate.set_temperature', target: { entity_id: 'climate.living_room' }, data: { temperature: 18 } }],
        },
      ],
    },
  },
  {
    slug: 'security-away-mode',
    name: 'Режим отсутствия',
    description: 'Когда все ушли — активирует охрану и выключает все огни',
    requiredEntities: ['alarm_control_panel', 'light'],
    automation: {
      alias: 'Tinta: Режим отсутствия',
      mode: 'single',
      trigger: [
        { platform: 'state', entity_id: 'group.all_persons', to: 'not_home' },
      ],
      action: [
        { service: 'alarm_control_panel.alarm_arm_away', target: { entity_id: 'alarm_control_panel.home' } },
        { service: 'light.turn_off', target: { entity_id: 'all' } },
        { service: 'cover.close_cover', target: { entity_id: 'all' } },
      ],
    },
  },
  {
    slug: 'security-arrive-home',
    name: 'Возвращение домой',
    description: 'Когда кто-то вернулся — снимает охрану и включает свет в коридоре',
    requiredEntities: ['alarm_control_panel', 'light'],
    automation: {
      alias: 'Tinta: Возвращение домой',
      mode: 'single',
      trigger: [
        { platform: 'state', entity_id: 'group.all_persons', to: 'home' },
      ],
      action: [
        { service: 'alarm_control_panel.alarm_disarm', target: { entity_id: 'alarm_control_panel.home' } },
        { service: 'light.turn_on', target: { area_id: 'hall' }, data: { brightness_pct: 60 } },
      ],
    },
  },
  {
    slug: 'energy-standby-off',
    name: 'Выкл. устройств в режиме ожидания',
    description: 'Ночью выключает TV, усилители и другие устройства в standby через умные розетки',
    requiredEntities: ['switch'],
    automation: {
      alias: 'Tinta: Standby off ночью',
      mode: 'single',
      trigger: [
        { platform: 'time', at: '00:30:00' },
      ],
      action: [
        { service: 'switch.turn_off', target: { device_class: 'outlet' } },
      ],
    },
  },
];

@Injectable()
export class GoldenTemplateSeedService implements OnModuleInit {
  private readonly logger = new Logger(GoldenTemplateSeedService.name);

  constructor(
    @InjectRepository(GoldenTemplate)
    private readonly repo: Repository<GoldenTemplate>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    let seeded = 0;
    for (const t of DEFAULT_TEMPLATES) {
      const exists = await this.repo.findOne({ where: { slug: t.slug } });
      if (!exists) {
        await this.repo.save(this.repo.create(t as any));
        seeded++;
      }
    }
    if (seeded > 0) {
      this.logger.log(`Seeded ${seeded} default golden templates`);
    }
  }
}
