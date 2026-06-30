import { LootTypesConfig, MapConfig, UserSettings } from '../domain/schemas';

export const lootTypesFixture: LootTypesConfig = {
  version: 1,
  types: [
    {
      id: 'diamond',
      name: '钻石',
      icon: 'assets/icons/diamond.svg',
      color: '#40D9FF',
      defaultSize: 28,
      valueLevel: 5,
      defaultVisible: true,
    },
    {
      id: 'keycard',
      name: '房卡',
      icon: 'assets/icons/keycard.svg',
      color: '#FFCC33',
      defaultSize: 28,
      valueLevel: 5,
      defaultVisible: false,
    },
  ],
};

export const mapFixture: MapConfig = {
  version: 1,
  id: 'zero-dam',
  name: '零号大坝',
  defaultCalibration: {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  },
  points: [
    {
      id: 'diamond-001',
      type: 'diamond',
      x: 0.5,
      y: 0.25,
      title: '二楼保险旁',
      description: '',
      screenshots: [],
      tags: ['高价值'],
    },
  ],
};

export const settingsFixture: UserSettings = {
  selectedMapId: 'zero-dam',
  visibleLootTypes: {
    diamond: true,
    keycard: false,
  },
};
