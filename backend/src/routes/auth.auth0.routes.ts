import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { getAuth0Strategy } from '../auth/auth0';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { AuthProvider } from '@prisma/client';

const router = Router();

router.get('/auth0/login', (req, res, next) => {
  getAuth0Strategy()
    .then((strategy) => {
      return getRuntimeConfig().then((runtime) => ({ strategy, runtime }));
    })
    .then(({ strategy, runtime }) => {
      if (runtime.activeProvider && runtime.activeProvider !== AuthProvider.AUTH0) {
        res.status(403).json({ error: 'Auth0 indisponível. Provedor ativo atual: SAML Google' });
        return;
      }
      if (!strategy) {
        res.status(404).json({ error: 'Auth0 desabilitado' });
        return;
      }
      passport.authenticate('auth0', {
        scope: 'openid email profile',
        session: false,
      })(req, res, next);
    })
    .catch(() => {
      res.status(500).json({ error: 'Erro ao iniciar Auth0' });
    });
});

router.get('/auth0/callback', (req, res, next) => {
  getAuth0Strategy()
    .then((strategy) => {
      return getRuntimeConfig().then((runtime) => ({ strategy, runtime }));
    })
    .then(({ strategy, runtime }) => {
      if (runtime.activeProvider && runtime.activeProvider !== AuthProvider.AUTH0) {
        const redirect = env.FRONTEND_URL;
        res.redirect(`${redirect}/login?error=provider_mismatch`);
        return;
      }
      if (!strategy) {
        const redirect = env.FRONTEND_URL;
        res.redirect(`${redirect}/login?error=auth0`);
        return;
      }

      passport.authenticate('auth0', { session: false }, async (err: any, user: any) => {
        const redirectBase = runtime.auth0.jwtRedirectUrl || env.FRONTEND_URL;

        if (err || !user) {
          res.redirect(`${redirectBase}/login?error=auth0`);
          return;
        }

        const tokenPayload = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        const callbackPath = redirectBase.includes('/auth/callback')
          ? redirectBase
          : `${redirectBase.replace(/\/$/, '')}/auth/callback`;
        const url = new URL(callbackPath);
        url.searchParams.set('token', accessToken);
        url.searchParams.set('refreshToken', refreshToken);
        res.redirect(url.toString());
      })(req, res, next);
    })
    .catch(() => {
      res.redirect(`${env.FRONTEND_URL}/login?error=auth0`);
    });
});

router.get('/auth0/status', async (_req, res) => {
  const runtime = await getRuntimeConfig();
  res.json({ enabled: runtime.auth0.enabled, activeProvider: runtime.activeProvider });
});

export { router as auth0AuthRoutes };
