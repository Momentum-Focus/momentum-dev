import { Test, TestingModule } from '@nestjs/testing';
import { SettingsFocusService } from './settings-focus.service';

describe('SettingsFocusService', () => {
  let service: SettingsFocusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsFocusService],
    }).compile();

    service = module.get<SettingsFocusService>(SettingsFocusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
