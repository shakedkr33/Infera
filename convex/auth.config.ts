// קובץ קונפיגורציה לאימות של Convex
// מגדיר את ספקי הזהות (Providers) שהאפליקציה תומכת בהם

export default {
  providers: [
    {
      // כתובת האתר של Convex (נלקחת ממשתני הסביבה)
      // משמשת לאימות דומיין וקישור ל-Backend
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
