import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestConfig } from './test-config';

describe('TestConfig', () => {
  let component: TestConfig;
  let fixture: ComponentFixture<TestConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestConfig],
    }).compileComponents();

    fixture = TestBed.createComponent(TestConfig);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
