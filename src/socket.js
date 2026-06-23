const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const { Message, ChatRoom } = require("./models/Message");

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || "http://localhost:4200",
        process.env.ADMIN_URL || "http://localhost:4300",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Middleware auth Socket
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Authentication token missing"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select(
        "name role zone isActive",
      );
      if (!user || !user.isActive) return next(new Error("Unauthorized"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  const connectedUsers = new Map();

  // Helper functions for broadcasting updates
  const emitBinUpdate = (binId, data) => {
    io.to(`bin:${binId}`).emit("bin:update", data);
    io.to("admin:room").emit("bin:update", data);
  };

  const emitReportUpdate = (reportId, data) => {
    io.to(`report:${reportId}`).emit("report:update", data);
    io.to("admin:room").emit("report:update", data);
  };

  const emitTourUpdate = (tourId, data) => {
    io.to(`tour:${tourId}`).emit("tour:update", data);
    io.to("admin:room").emit("tour:update", data);
  };

  // Export helpers for use in controllers
  io.emitBinUpdate = emitBinUpdate;
  io.emitReportUpdate = emitReportUpdate;
  io.emitTourUpdate = emitTourUpdate;

  io.on("connection", (socket) => {
    const user = socket.user;
    connectedUsers.set(user._id.toString(), socket.id);

    console.log(`🔌 Connecté: ${user.name} (${user.role}) — ID: ${socket.id}`);

    // Rejoindre les rooms
    socket.join(`zone:${user.zone}`);
    socket.join(`role:${user.role}`);
    socket.join(`user:${user._id}`);

    if (["admin", "super_admin", "admin_municipal"].includes(user.role)) {
      socket.join("admin:room");
    }

    // Annonce de connexion
    io.emit("user:online", {
      userId: user._id,
      name: user.name,
      role: user.role,
    });

    // ===== CHAT =====
    socket.on("chat:join", (roomId) => {
      socket.join(roomId);
    });

    socket.on("chat:leave", (roomId) => {
      socket.leave(roomId);
    });

    socket.on("message:typing", ({ roomId, isTyping }) => {
      socket.to(roomId).emit("message:typing", {
        userId: user._id,
        name: user.name,
        isTyping,
      });
    });

    // ===== BACS =====
    socket.on("bin:subscribe", (binId) => {
      socket.join(`bin:${binId}`);
    });

    socket.on("bin:unsubscribe", (binId) => {
      socket.leave(`bin:${binId}`);
    });

    // ===== REPORTS =====
    socket.on("report:subscribe", (reportId) => {
      socket.join(`report:${reportId}`);
    });

    socket.on("report:unsubscribe", (reportId) => {
      socket.leave(`report:${reportId}`);
    });

    // ===== TOURS =====
    socket.on("tour:subscribe", (tourId) => {
      socket.join(`tour:${tourId}`);
    });

    socket.on("tour:unsubscribe", (tourId) => {
      socket.leave(`tour:${tourId}`);
    });

    // ===== STATS LIVE =====
    const statsInterval = setInterval(async () => {
      try {
        const Bin = require("./models/Bin");
        const Report = require("./models/Report");
        const [binsAlert, pendingReports] = await Promise.all([
          Bin.countDocuments({ fillLevel: { $gte: 80 } }),
          Report.countDocuments({ status: "pending" }),
        ]);
        socket.emit("stats:live", {
          binsAlert,
          pendingReports,
          timestamp: new Date(),
          connectedUsers: connectedUsers.size,
        });
      } catch {}
    }, 60000);

    // ===== DÉCONNEXION =====
    socket.on("disconnect", () => {
      connectedUsers.delete(user._id.toString());
      clearInterval(statsInterval);
      io.emit("user:offline", { userId: user._id });
      console.log(`🔌 Déconnecté: ${user.name}`);
    });

    // ===== ADMIN: broadcast =====
    socket.on("alert:broadcast", async (data) => {
      if (!["admin", "super_admin", "admin_municipal"].includes(user.role))
        return;
      const { zone, title, body, type } = data;
      if (zone) {
        io.to(`zone:${zone}`).emit("alert:broadcast", {
          title,
          body,
          type,
          zone,
          from: user.name,
        });
      } else {
        io.emit("alert:broadcast", { title, body, type, from: user.name });
      }
    });
  });

  return io;
};

module.exports = initSocket;
