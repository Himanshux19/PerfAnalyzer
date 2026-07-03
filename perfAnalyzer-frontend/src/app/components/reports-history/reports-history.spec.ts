import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsHistory } from './reports-history';
import { provideRouter } from '@angular/router';

describe('ReportsHistory', () => {
  let component: ReportsHistory;
  let fixture: ComponentFixture<ReportsHistory>;

  beforeEach(async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', 'fake-token');
    }
    await TestBed.configureTestingModule({
      imports: [ReportsHistory],
      providers: [
        provideRouter([
          { path: 'login', component: class {} }
        ])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
