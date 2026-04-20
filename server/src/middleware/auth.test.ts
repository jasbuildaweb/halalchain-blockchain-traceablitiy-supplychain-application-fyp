import jwt from "jsonwebtoken";
import { authenticate, optionalAuth } from "./auth";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types";

// Set a deterministic secret before any imports resolve the env
process.env.JWT_SECRET = "jest-test-secret-halalchain";

const SECRET  = process.env.JWT_SECRET;
const PAYLOAD = { userId: "user-001", email: "mfr@example.com", role: "MANUFACTURER" as const };

function mockRes() {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(authHeader?: string): AuthRequest {
  return { headers: authHeader ? { authorization: authHeader } : {} } as AuthRequest;
}

// ─── authenticate ─────────────────────────────────────────────────────────────

describe("authenticate middleware", function () {

  it("calls next() and attaches req.user for a valid Bearer token", function () {
    const token = jwt.sign(PAYLOAD, SECRET);
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.userId).toBe("user-001");
    expect(req.user?.email).toBe("mfr@example.com");
    expect(req.user?.role).toBe("MANUFACTURER");
  });

  it("includes walletAddress in req.user when present in token", function () {
    const token = jwt.sign({ ...PAYLOAD, walletAddress: "0xDEADBEEF" }, SECRET);
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(req.user?.walletAddress).toBe("0xDEADBEEF");
  });

  it("returns 401 when no Authorization header is provided", function () {
    const req  = mockReq();
    const res  = mockRes();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "No token provided" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is tampered", function () {
    const token = jwt.sign(PAYLOAD, SECRET) + "TAMPERED";
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is signed with a different secret", function () {
    const token = jwt.sign(PAYLOAD, "wrong-secret-entirely");
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an expired token", function () {
    const token = jwt.sign(PAYLOAD, SECRET, { expiresIn: "0s" });
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header does not start with 'Bearer '", function () {
    const token = jwt.sign(PAYLOAD, SECRET);
    const req   = mockReq(`Token ${token}`);  // wrong scheme
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ─── optionalAuth ─────────────────────────────────────────────────────────────

describe("optionalAuth middleware", function () {

  it("attaches req.user when a valid token is present", function () {
    const token = jwt.sign(PAYLOAD, SECRET);
    const req   = mockReq(`Bearer ${token}`);
    const res   = mockRes();
    const next  = jest.fn() as jest.MockedFunction<NextFunction>;

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.email).toBe("mfr@example.com");
  });

  it("calls next() without error when no token is present", function () {
    const req  = mockReq();
    const res  = mockRes();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it("calls next() without error when token is invalid (does not reject)", function () {
    const req  = mockReq("Bearer not-a-valid-token");
    const res  = mockRes();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });
});
