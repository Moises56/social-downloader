import { Routes } from '@angular/router';
import { DownloaderPageComponent } from './downloader-page.component';
import { StudioPageComponent } from './features/studio/studio.page';

export const routes: Routes = [
  { path: '', component: DownloaderPageComponent },
  { path: 'studio', component: StudioPageComponent },
  { path: '**', redirectTo: '' },
];
