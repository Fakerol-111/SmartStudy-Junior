from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    grade = Column(String(20), default="初一")           # 初一 / 初二 / 初三
    subjects = Column(Text, default="[]")                 # JSON 数组，如 '["math","english"]'
    extra_info = Column(Text, default="")                  # JSON 额外信息
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    conversations = relationship("Conversation", back_populates="student", cascade="all, delete-orphan")
    mistakes = relationship("MistakeBook", back_populates="student", cascade="all, delete-orphan")
    knowledge_nodes = relationship("KnowledgeNode", back_populates="student", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(50), default="general")
    title = Column(String(200), default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student = relationship("Student", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)              # system / user / assistant / tool
    content = Column(Text, nullable=False, default="")
    tool_name = Column(String(50), default="")
    tool_args = Column(Text, default="")
    tool_result = Column(Text, default="")
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("Conversation", back_populates="messages")


class MistakeBook(Base):
    __tablename__ = "mistake_book"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(50), nullable=False)           # 学科
    question = Column(Text, nullable=False)                 # 题目内容（含 LaTeX）
    correct_answer = Column(Text, default="")               # 正确答案
    student_answer = Column(Text, default="")               # 学生的错误答案
    analysis = Column(Text, default="")                     # 错因分析
    knowledge_points = Column(Text, default="[]")           # JSON 关联知识点
    mistake_type = Column(String(50), default="other")      # conceptual / calculation / careless / other
    created_at = Column(DateTime, server_default=func.now())

    student = relationship("Student", back_populates="mistakes")


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject = Column(String(50), nullable=False)
    node_name = Column(String(200), nullable=False)        # 知识点名称
    mastery_level = Column(Float, default=0.0)              # 掌握程度 0.0 ~ 1.0
    parent_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student = relationship("Student", back_populates="knowledge_nodes")
    children = relationship("KnowledgeNode", backref="parent", remote_side=[id], cascade="all, delete-orphan", single_parent=True)
