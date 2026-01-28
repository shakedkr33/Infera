import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// הגדרת נתיבי HTTP עבור אימות (Convex Auth)
// זה מאפשר ביצוע פעולות אימות דרך HTTP Endpoints
auth.addHttpRoutes(http);

export default http;
