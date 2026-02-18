import { Router } from 'express';
import passport from 'passport';
import { env } from '../config/env';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { getSamlStrategy } from '../auth/saml';
import { getRuntimeConfig } from '../config/runtimeConfig';
import { AuthProvider } from '@prisma/client';

const router = Router();

router.get('/saml/login', (req, res, next) => {
  getSamlStrategy()
    .then((strategy) => {
      return getRuntimeConfig().then((runtime) => ({ strategy, runtime }));
    })
    .then(({ strategy, runtime }) => {
      if (runtime.activeProvider && runtime.activeProvider !== AuthProvider.SAML_GOOGLE) {
        res.status(403).json({ error: 'SAML indisponível. Provedor ativo atual: Auth0' });
        return;
      }
      if (!strategy) {
        res.status(404).json({ error: 'SAML desabilitado' });
        return;
      }
      passport.authenticate('saml', { session: false })(req, res, next);
    })
    .catch(() => {
      res.status(500).json({ error: 'Erro ao iniciar SAML' });
    });
});

router.post('/saml/acs', (req, res, next) => {
  getSamlStrategy()
    .then((strategy) => {
      return getRuntimeConfig().then((runtime) => ({ strategy, runtime }));
    })
    .then(({ strategy, runtime }) => {
      if (runtime.activeProvider && runtime.activeProvider !== AuthProvider.SAML_GOOGLE) {
        res.status(403).json({ error: 'SAML indisponível. Provedor ativo atual: Auth0' });
        return;
      }
      if (!strategy) {
        res.status(404).json({ error: 'SAML desabilitado' });
        return;
      }

      passport.authenticate('saml', { session: false }, async (err: any, user: any) => {
        if (err || !user) {
          const redirect = runtime.saml.jwtRedirectUrl || env.FRONTEND_URL;
          res.redirect(`${redirect}?error=saml`);
          return;
        }

        const tokenPayload = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };

        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        if (runtime.saml.jwtRedirectUrl) {
          const url = new URL(runtime.saml.jwtRedirectUrl);
          url.searchParams.set('token', accessToken);
          url.searchParams.set('refreshToken', refreshToken);
          res.redirect(url.toString());
          return;
        }

        res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
          },
          accessToken,
          refreshToken,
          authProvider: 'saml',
        });
      })(req, res, next);
    })
    .catch(() => {
      res.status(500).json({ error: 'Erro ao autenticar SAML' });
    });
});

router.get('/saml/metadata', (_req, res) => {
  getSamlStrategy()
    .then((strategy) => {
      if (!strategy) {
        res.status(404).json({ error: 'SAML desabilitado' });
        return;
      }
      res.type('application/xml');
      res.send(strategy.generateServiceProviderMetadata(''));
    })
    .catch(() => {
      res.status(500).json({ error: 'Erro ao gerar metadata SAML' });
    });
});

router.get('/saml/status', async (_req, res) => {
  const runtime = await getRuntimeConfig();
  res.json({ enabled: runtime.saml.enabled, activeProvider: runtime.activeProvider });
});

router.post('/saml/logout', (_req, res) => {
  res.status(204).send();
});

export { router as samlAuthRoutes };
