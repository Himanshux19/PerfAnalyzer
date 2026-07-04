import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsHistory } from './reports-history';
import { provideRouter } from '@angular/router';
import { ApiService } from '../../api.service';
import { of } from 'rxjs';

describe('ReportsHistory', () => {
  let component: ReportsHistory;
  let fixture: ComponentFixture<ReportsHistory>;
  let mockApiService: any;

  beforeEach(async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', 'fake-token');
    }

    mockApiService = {
      listReports: () => of([]),
      deleteReport: () => of({})
    };

    await TestBed.configureTestingModule({
      imports: [ReportsHistory],
      providers: [
        provideRouter([
          { path: 'login', component: class {} }
        ]),
        { provide: ApiService, useValue: mockApiService }
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
