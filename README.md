# Secure Clipboard Chrome Extension

A secure, enterprise-grade clipboard management Chrome extension that allows users to copy and store multiple text snippets securely. Built with Spring Boot, PostgreSQL, and Redis, demonstrating advanced system design principles including security, performance optimization, and scalability.

## 🎯 Project Overview

This project addresses the security concerns with open-source clipboard managers (like Maccy) by providing a secure, authenticated clipboard solution. It demonstrates:

- **Security-First Architecture**: JWT authentication, RBAC, HTTPS/TLS, rate limiting
- **Performance Optimization**: Large text chunking, Redis caching, async processing
- **Scalability**: Stateless design, database optimization, horizontal scaling capability
- **Production Readiness**: CI/CD pipeline, Docker deployment, monitoring

## 🏗️ Architecture

```
Chrome Extension (UI + Background Script)
        |
        v
Spring Boot Backend (REST APIs)
        |
        +---> Redis (Cache: Recent snippets, Rate limiting, Token blacklist)
        |
        v
PostgreSQL (Primary Storage: Users, Snippets, Chunks)
```

### Key Components

1. **Chrome Extension**: Captures clipboard events, manages authentication, displays snippets
2. **Spring Boot Backend**: RESTful APIs with Spring Security, JWT, RBAC
3. **PostgreSQL**: Primary data storage with chunking for large text
4. **Redis**: Fast cache for recent snippets, rate limiting, token management

## 🔐 Security Features

- **Authentication**: JWT-based stateless authentication with refresh tokens
- **Authorization**: Role-Based Access Control (RBAC) with USER/ADMIN roles
- **Transport Security**: HTTPS/TLS enforced
- **Input Validation**: Request size limits, content validation, sanitization
- **Rate Limiting**: Protection against abuse on auth and API endpoints
- **Data Protection**: BCrypt password hashing, encrypted token storage

## 🚀 Key Features

- **Secure Clipboard Storage**: Store multiple text snippets with authentication
- **Large Text Handling**: Chunking strategy for handling large text efficiently
- **Fast Access**: Redis cache for instant retrieval of recent snippets
- **User Limits**: Configurable storage limits per user with queue-based management
- **Cross-Origin Support**: Works across all Chrome tabs and pages

## 📚 Documentation

- **[Architecture Review](./ARCHITECTURE_REVIEW.md)**: Comprehensive system design analysis, security review, and recommendations
- **[Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md)**: Step-by-step guide for building the project

## 🛠️ Technology Stack

- **Backend**: Spring Boot 3.x (Java 17+)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Frontend**: Chrome Extension (Manifest V3)
- **Security**: Spring Security + JWT
- **Deployment**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

## 📋 Quick Start

### Prerequisites

- Java 17+
- Maven 3.8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Chrome Browser

### Backend Setup

```bash
# Clone repository
git clone <repository-url>
cd Secure-copy-plugin

# Start dependencies
docker-compose up -d postgres redis

# Run backend
./mvnw spring-boot:run
```

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory
5. Configure backend URL in extension settings

## 📊 System Design Highlights

### Large Text Handling
- **Chunking**: 64KB chunks for efficient storage and retrieval
- **Compression**: GZIP compression for chunks > 100KB
- **Deduplication**: Content hashing for duplicate detection

### Storage Strategy
- **Primary**: PostgreSQL for persistent, ACID-compliant storage
- **Cache**: Redis for fast access to recent snippets
- **Queue**: Redis-based FIFO queue for maintaining recent snippet limits

### Performance Optimizations
- Async processing for I/O-bound operations
- Database indexing for fast queries
- Connection pooling for efficient database access
- Pagination for large result sets

## 🔍 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login (returns JWT)
- `POST /api/v1/auth/refresh` - Refresh access token

### Snippets
- `POST /api/v1/snippets` - Create new snippet
- `GET /api/v1/snippets` - List snippets (paginated)
- `GET /api/v1/snippets/{id}` - Get single snippet
- `DELETE /api/v1/snippets/{id}` - Soft delete snippet

## 🧪 Testing

```bash
# Run all tests
./mvnw test

# Run with coverage
./mvnw test jacoco:report
```

## 🚢 Deployment

### Docker Compose

```bash
docker-compose up -d
```

### Production

See [Architecture Review](./ARCHITECTURE_REVIEW.md) for detailed deployment strategies including:
- Docker Compose setup
- Single VM deployment
- Platform-managed deployment (Railway/Render/Fly.io)

## 📈 Architecture Rating

**Overall: 8.5/10**

- **Architecture**: 9/10 - Clean, scalable, appropriate complexity
- **Security**: 9/10 - Strong foundation with comprehensive protections
- **Performance**: 8/10 - Good optimization strategies
- **Scalability**: 8/10 - Stateless design enables horizontal scaling
- **Reliability**: 7/10 - Needs monitoring and backup strategy

See [Architecture Review](./ARCHITECTURE_REVIEW.md) for detailed analysis.

## 🎓 Interview Talking Points

This project demonstrates:

1. **Security Expertise**: Defense-in-depth security with multiple layers
2. **Performance Optimization**: Chunking, caching, async processing
3. **System Design**: Scalable architecture with clear separation of concerns
4. **Production Readiness**: CI/CD, Docker, monitoring, error handling

## 📝 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines if applicable]

---

**Note**: This is a resume project designed to showcase system design and security expertise. See the [Architecture Review](./ARCHITECTURE_REVIEW.md) for detailed technical analysis and recommendations.
